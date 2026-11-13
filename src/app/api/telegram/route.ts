import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { getTodayInSeoul } from "@/lib/date"
import { formatKRW, isVatExemptForPayment } from "@/lib/money"
import { PAYMENT_METHOD_LABELS } from "@/lib/constants/payment-method"
import { softDelete } from "@/lib/soft-delete/soft-delete"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  allowedChatIds,
  callTelegram,
  safeEqual,
  webhookSecret,
} from "@/lib/telegram/bot"
import { detectKind, parseSaleLines, type ParsedSale } from "@/lib/telegram/parse-sale"

export const dynamic = "force-dynamic"

const HELP = [
  "첫 줄에 종류(매출·지출·배차, 줄여서 매·지·배), 다음 줄부터 한 줄에 하나씩 써 주세요.",
  "",
  "매출 예:",
  "매출",
  "75만",
  "피셔",
  "칠곡경북대,부산대",
  "우영",
  "",
  "· 금액·날짜(11/14, 어제)·지불방법(계산서·이체·현금)·출처(카톡,스마일,오더자 / 거래처 이름)는 아무 줄에나",
  "· 나머지 줄은 차례로 상차지 → 하차지",
  "· 날짜를 안 쓰면 오늘, 지불방법을 안 쓰면 세금계산서",
].join("\n")

type TelegramUpdate = {
  message?: { chat: { id: number }; text?: string }
  callback_query?: {
    id: string
    data?: string
    message?: { chat: { id: number }; message_id: number; text?: string }
  }
}

function sendText(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  return callTelegram("sendMessage", { chat_id: chatId, text, ...extra })
}

function refreshApp() {
  revalidatePath("/")
  revalidatePath("/sales")
}

function saleSummary(sale: ParsedSale, vat: number, duplicate: boolean): string {
  const source = [sale.source_major, sale.source_sub, sale.source_minor].filter(Boolean).join(" · ")
  return [
    `✅ 매출 등록 (${Number(sale.sale_date.slice(5, 7))}/${Number(sale.sale_date.slice(8))})`,
    `${sale.origin} → ${sale.destination}`,
    source ? `출처: ${source}` : null,
    `공급가액 ${sale.supply_amount.toLocaleString("ko-KR")} + 세액 ${vat.toLocaleString("ko-KR")} = ${formatKRW(sale.supply_amount + vat)}`,
    `${PAYMENT_METHOD_LABELS[sale.payment_method]} · 미입금`,
    sale.memo ? `비고: ${sale.memo}` : null,
    duplicate ? "⚠️ 같은 날·같은 구간·같은 금액 매출이 이미 있어요. 실수면 [취소]를 눌러 주세요." : null,
  ]
    .filter((line) => line !== null)
    .join("\n")
}

async function handleSale(chatId: number, lines: string[]) {
  const supabase = createAdminClient()
  const [sourcesRes, clientsRes] = await Promise.all([
    supabase.from("sale_sources").select("major, sub").is("deleted_at", null),
    supabase.from("clients").select("id, name").is("deleted_at", null),
  ])
  if (sourcesRes.error || clientsRes.error) throw new Error("출처·거래처 목록을 못 읽었습니다")

  const parsed = parseSaleLines(lines, {
    today: getTodayInSeoul(),
    sources: sourcesRes.data,
    clients: clientsRes.data,
  })
  if (!parsed.ok) {
    await sendText(chatId, `❓ ${parsed.error}\n\n등록하지 않았어요. 고쳐서 다시 보내 주세요.`)
    return
  }
  const sale = parsed.value

  const { count } = await supabase
    .from("sales")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("sale_date", sale.sale_date)
    .eq("origin", sale.origin)
    .eq("destination", sale.destination)
    .eq("supply_amount", sale.supply_amount)

  const isVatExempt = isVatExemptForPayment(sale.payment_method)
  const { data: id, error } = await supabase.rpc("create_sale", {
    p_sale_date: sale.sale_date,
    p_origin: sale.origin,
    p_destination: sale.destination,
    p_supply_amount: sale.supply_amount,
    p_is_vat_exempt: isVatExempt,
    p_payment_method: sale.payment_method,
    p_source_major: sale.source_major,
    p_source_minor: sale.source_minor,
    p_source_note: null,
    p_memo: sale.memo,
    p_client_id: sale.client_id,
    p_source_sub: sale.source_sub,
  })
  if (error || !id) {
    await sendText(chatId, `⚠️ 저장하지 못했어요: ${error?.message ?? "알 수 없는 오류"}`)
    return
  }
  refreshApp()

  // 세액 계산은 create_sale과 같은 규칙(반올림 10%)
  const vat = isVatExempt ? 0 : Math.floor((sale.supply_amount + 5) / 10)
  await sendText(chatId, saleSummary(sale, vat, (count ?? 0) > 0), {
    reply_markup: { inline_keyboard: [[{ text: "취소", callback_data: `cancel:sales:${id}` }]] },
  })
}

async function handleCancel(query: NonNullable<TelegramUpdate["callback_query"]>) {
  const match = query.data?.match(/^cancel:(sales):([0-9a-f-]{36})$/)
  const message = query.message
  if (!match || !message) {
    await callTelegram("answerCallbackQuery", { callback_query_id: query.id })
    return
  }
  try {
    await softDelete(createAdminClient(), match[1] as "sales", match[2])
    refreshApp()
    await callTelegram("editMessageText", {
      chat_id: message.chat.id,
      message_id: message.message_id,
      text: `❌ 취소했어요 (앱 휴지통에서 되살릴 수 있어요)\n\n${message.text ?? ""}`,
    })
    await callTelegram("answerCallbackQuery", { callback_query_id: query.id, text: "취소했어요" })
  } catch (error) {
    console.error("telegram cancel failed", error)
    await callTelegram("answerCallbackQuery", {
      callback_query_id: query.id,
      text: "취소하지 못했어요. 앱에서 지워 주세요.",
      show_alert: true,
    })
  }
}

/** 텔레그램 봇 웹훅: 허락된 대화방의 메시지로 매출을 등록하고 [취소] 버튼을 처리한다. */
export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const given = request.headers.get("x-telegram-bot-api-secret-token") ?? ""
  if (!token || !safeEqual(given, webhookSecret(token))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const update = (await request.json()) as TelegramUpdate
  const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id
  if (chatId === undefined) return NextResponse.json({ ok: true })

  // 텔레그램은 200을 못 받으면 같은 메시지를 다시 보내므로(중복 등록) 오류가 나도 200으로 끝낸다.
  try {
    if (!allowedChatIds().includes(String(chatId))) {
      await sendText(
        chatId,
        `이 대화방은 아직 등록되지 않았어요.\n대화방 번호: ${chatId}\n\n이 번호를 Vercel 환경 변수 TELEGRAM_CHAT_ID에 넣어 주세요.`
      )
      return NextResponse.json({ ok: true })
    }

    if (update.callback_query) {
      await handleCancel(update.callback_query)
      return NextResponse.json({ ok: true })
    }

    const lines = (update.message?.text ?? "").split("\n").map((l) => l.trim()).filter(Boolean)
    const kind = lines.length > 0 ? detectKind(lines[0]) : null
    if (kind === "sale") {
      await handleSale(chatId, lines.slice(1))
    } else if (kind === "expense" || kind === "dispatch") {
      await sendText(chatId, "지출·배차 등록은 곧 준비할게요. 지금은 매출만 돼요.")
    } else {
      await sendText(chatId, HELP)
    }
  } catch (error) {
    console.error("telegram webhook failed", error)
    await sendText(chatId, "⚠️ 처리 중 오류가 났어요. 등록됐는지 앱에서 확인해 주세요.").catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
