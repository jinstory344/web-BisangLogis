import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { recordAuditLog } from "@/lib/audit/log"
import { getTodayInSeoul } from "@/lib/date"
import { formatKRW, isVatExemptForPayment } from "@/lib/money"
import { CARGO_BOX_TYPE_LABELS } from "@/lib/constants/cargo-box-type"
import { DROPOFF_TYPE_LABELS } from "@/lib/constants/dropoff-type"
import {
  EXPENSE_PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants/payment-method"
import { softDelete } from "@/lib/soft-delete/soft-delete"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  allowedChatIds,
  callTelegram,
  safeEqual,
  webhookSecret,
} from "@/lib/telegram/bot"
import { parseDispatchLines } from "@/lib/telegram/parse-dispatch"
import { parseExpenseLines } from "@/lib/telegram/parse-expense"
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
  "지인,마상구",
  "세금 주주부린물류",
  "",
  "· 출처는 '지인,마상구'·'카톡,스마일,오더자'처럼 쉼표로, 거래처는 이름 앞글자(우영)만",
  "· 사업자 정보는 '세금 상호' (세금계산서로 들어가요)",
  "· 금액·날짜(11/14, 어제)·지불방법(이체·현금)·출처·사업자 정보는 아무 줄에나",
  "· 나머지 줄은 차례로 상차지 → 하차지",
  "· 날짜를 안 쓰면 오늘, 지불방법을 안 쓰면 세금계산서",
  "",
  "지출 예:",
  "지출",
  "8만",
  "주유",
  "(결제방법 카드·이체·현금, 안 쓰면 카드 / 나머지 줄은 비고)",
  "",
  "배차 예:",
  "배차",
  "부산2곳",
  "현대그린",
  "익착",
  "33만",
  "아토무역 이재근 010-1234-5678",
  "서울86바7754 김진승 010-9876-5432",
  "냉동3",
  "1.6",
  "(하차일 안 쓰면 당착 / 수수료는 수2만 / 냉동3 = 냉동탑 3파레트 / 1.6 = 1.6톤",
  " 거래처 줄 = 거래처 담당자 연락처, 차량 줄 = 차량번호 차주 연락처, 연락처는 빼도 돼요.",
  " 등록된 차량이면 차주 연락처는 자동)",
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

type CancelTable = "sales" | "expenses" | "dispatches"

function refreshApp(table: CancelTable) {
  revalidatePath("/")
  revalidatePath(`/${table}`)
}

function shortDate(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`
}

function won(n: number): string {
  return n.toLocaleString("ko-KR")
}

function cancelButton(table: CancelTable, id: string) {
  return { reply_markup: { inline_keyboard: [[{ text: "취소", callback_data: `cancel:${table}:${id}` }]] } }
}

async function askAgain(chatId: number, error: string) {
  await sendText(chatId, `❓ ${error}\n\n등록하지 않았어요. 고쳐서 다시 보내 주세요.`)
}

function saleSummary(sale: ParsedSale, vat: number, duplicate: boolean): string {
  const source = [sale.source_major, sale.source_sub, sale.source_minor].filter(Boolean).join(" · ")
  return [
    `✅ 매출 등록 (${shortDate(sale.sale_date)})`,
    `${sale.origin} → ${sale.destination}`,
    source ? `출처: ${source}` : null,
    sale.billing_entity_name ? `사업자 정보: ${sale.billing_entity_name}` : null,
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
  if (!parsed.ok) return askAgain(chatId, parsed.error)
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
    p_billing_entity_name: sale.billing_entity_name,
    p_client_id: sale.client_id,
    p_source_sub: sale.source_sub,
  })
  if (error || !id) {
    await sendText(chatId, `⚠️ 저장하지 못했어요: ${error?.message ?? "알 수 없는 오류"}`)
    return
  }
  refreshApp("sales")

  // 세액 계산은 create_sale과 같은 규칙(반올림 10%)
  const vat = isVatExempt ? 0 : Math.floor((sale.supply_amount + 5) / 10)
  await sendText(chatId, saleSummary(sale, vat, (count ?? 0) > 0), cancelButton("sales", id))
}

async function handleExpense(chatId: number, lines: string[]) {
  const supabase = createAdminClient()
  const { data: categories, error: catError } = await supabase
    .from("expense_categories")
    .select("major, minor")
    .is("deleted_at", null)
    .not("minor", "is", null)
  if (catError) throw new Error("지출 분류 목록을 못 읽었습니다")

  const parsed = parseExpenseLines(lines, {
    today: getTodayInSeoul(),
    categories: categories.map((c) => ({ major: c.major, minor: c.minor as string })),
  })
  if (!parsed.ok) return askAgain(chatId, parsed.error)
  const expense = parsed.value

  const insertValues = {
    expense_date: expense.expense_date,
    category_major: expense.category_major,
    category_minor: expense.category_minor,
    amount: expense.amount,
    payment_method: expense.payment_method,
    installment_months: null,
    vendor: null,
    has_tax_invoice: false,
    memo: expense.memo,
  }
  const { data, error } = await supabase.from("expenses").insert(insertValues).select("id").single()
  if (error || !data) {
    await sendText(chatId, `⚠️ 저장하지 못했어요: ${error?.message ?? "알 수 없는 오류"}`)
    return
  }
  await recordAuditLog(supabase, {
    tableName: "expenses",
    recordId: data.id,
    action: "CREATE",
    afterData: insertValues,
  })
  refreshApp("expenses")

  const text = [
    `✅ 지출 등록 (${shortDate(expense.expense_date)})`,
    `${expense.category_major} › ${expense.category_minor}`,
    `${formatKRW(expense.amount)} · ${EXPENSE_PAYMENT_METHOD_LABELS[expense.payment_method]}`,
    expense.memo ? `비고: ${expense.memo}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n")
  await sendText(chatId, text, cancelButton("expenses", data.id))
}

async function handleDispatch(chatId: number, lines: string[]) {
  const supabase = createAdminClient()
  const [clientsRes, vehiclesRes] = await Promise.all([
    supabase.from("clients").select("id, name").is("deleted_at", null),
    supabase.from("vehicles").select("id, plate_no, driver_name, driver_phone").is("deleted_at", null),
  ])
  if (clientsRes.error || vehiclesRes.error) throw new Error("거래처·차량 목록을 못 읽었습니다")

  const parsed = parseDispatchLines(lines, {
    today: getTodayInSeoul(),
    clients: clientsRes.data,
    vehicles: vehiclesRes.data,
  })
  if (!parsed.ok) return askAgain(chatId, parsed.error)
  const d = parsed.value

  // 차량 정보에 없는 차량이면 목록에도 추가한다(차주 이름이 있어야 차량을 등록할 수 있다).
  let addedVehicle = false
  if (!d.vehicle_id && d.plate_no_snapshot && d.driver_name_snapshot) {
    const vehicleValues = {
      plate_no: d.plate_no_snapshot,
      driver_name: d.driver_name_snapshot,
      driver_phone: d.driver_phone_snapshot,
      vehicle_type: d.cargo_box_type ? CARGO_BOX_TYPE_LABELS[d.cargo_box_type] : null,
    }
    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .insert(vehicleValues)
      .select("id")
      .single()
    if (vehicle) {
      await recordAuditLog(supabase, {
        tableName: "vehicles",
        recordId: vehicle.id,
        action: "CREATE",
        afterData: vehicleValues,
      })
      d.vehicle_id = vehicle.id
      addedVehicle = true
      revalidatePath("/vehicles")
    } else {
      // 같은 번호가 휴지통에 있는 경우 등 — 배차는 차량 연결 없이 그대로 저장한다
      console.error("telegram vehicle insert failed", vehicleError)
    }
  }

  const { data: id, error } = await supabase.rpc("create_dispatch", {
    p_dispatch_date: d.dispatch_date,
    p_client_id: d.client_id,
    p_origin: d.origin,
    p_destination: d.destination,
    p_dropoff_type: d.dropoff_type,
    p_pallet_count: d.pallet_count,
    p_weight_ton: d.weight_ton,
    p_vehicle_id: d.vehicle_id,
    p_plate_no_snapshot: d.plate_no_snapshot,
    p_driver_name_snapshot: d.driver_name_snapshot,
    p_driver_phone_snapshot: d.driver_phone_snapshot,
    p_contact_name: d.contact_name,
    p_contact_phone: d.contact_phone,
    p_memo: d.memo,
    p_cargo_box_type: d.cargo_box_type,
    p_freight_amount: d.freight_amount,
    p_fee_amount: d.fee_amount,
  })
  if (error || !id) {
    await sendText(chatId, `⚠️ 저장하지 못했어요: ${error?.message ?? "알 수 없는 오류"}`)
    return
  }
  refreshApp("dispatches")

  const cargo = [
    d.cargo_box_type ? CARGO_BOX_TYPE_LABELS[d.cargo_box_type] : null,
    d.pallet_count !== null ? `${d.pallet_count}파레트` : null,
    d.weight_ton !== null ? `${d.weight_ton}톤` : null,
  ].filter(Boolean)
  const vehicle = [d.plate_no_snapshot, d.driver_name_snapshot, d.driver_phone_snapshot].filter(Boolean)
  const text = [
    `✅ 배차 등록 (${shortDate(d.dispatch_date)} · ${DROPOFF_TYPE_LABELS[d.dropoff_type]})`,
    `${d.origin} → ${d.destination}`,
    `거래처: ${[d.client_name, d.contact_name, d.contact_phone].filter(Boolean).join(" · ")}`,
    `운임 ${d.freight_amount !== null ? `${won(d.freight_amount)}원` : "-"}${d.fee_amount ? ` · 수수료 ${won(d.fee_amount)}원` : ""}`,
    vehicle.length > 0
      ? `차량: ${vehicle.join(" ")}${addedVehicle ? " (차량 정보에 새로 추가)" : d.vehicle_id ? "" : " (차량 정보에는 없음)"}`
      : null,
    cargo.length > 0 ? `차종: ${cargo.join(" · ")}` : null,
    d.memo ? `비고: ${d.memo}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n")
  await sendText(chatId, text, cancelButton("dispatches", id))
}

/**
 * 배차를 취소할 때, 그 배차와 함께 봇이 차량 정보에 추가했던 차량이면(배차 직전 1분 안에 생겼고
 * 다른 배차에 쓰이지 않음) 같이 뺀다. 잘못 쓴 번호가 차량 목록에 남지 않게.
 */
async function removeVehicleAddedWith(dispatchId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data: dispatch } = await supabase
    .from("dispatches")
    .select("vehicle_id, created_at")
    .eq("id", dispatchId)
    .single()
  if (!dispatch?.vehicle_id) return false

  const [{ data: vehicle }, { count }] = await Promise.all([
    supabase.from("vehicles").select("created_at").eq("id", dispatch.vehicle_id).is("deleted_at", null).single(),
    supabase
      .from("dispatches")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", dispatch.vehicle_id)
      .is("deleted_at", null),
  ])
  if (!vehicle || (count ?? 0) > 0) return false
  const gap = new Date(dispatch.created_at).getTime() - new Date(vehicle.created_at).getTime()
  if (gap < 0 || gap > 60_000) return false

  await softDelete(supabase, "vehicles", dispatch.vehicle_id)
  revalidatePath("/vehicles")
  return true
}

async function handleCancel(query: NonNullable<TelegramUpdate["callback_query"]>) {
  const match = query.data?.match(/^cancel:(sales|expenses|dispatches):([0-9a-f-]{36})$/)
  const message = query.message
  if (!match || !message) {
    await callTelegram("answerCallbackQuery", { callback_query_id: query.id })
    return
  }
  try {
    const table = match[1] as CancelTable
    const supabase = createAdminClient()
    await softDelete(supabase, table, match[2])
    const removedVehicle = table === "dispatches" ? await removeVehicleAddedWith(match[2]) : false
    refreshApp(table)
    await callTelegram("editMessageText", {
      chat_id: message.chat.id,
      message_id: message.message_id,
      text: `❌ 취소했어요${removedVehicle ? " · 함께 추가했던 차량도 뺐어요" : ""} (앱 휴지통에서 되살릴 수 있어요)\n\n${message.text ?? ""}`,
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

/** 텔레그램 봇 웹훅: 허락된 대화방의 메시지로 매출·지출·배차를 등록하고 [취소] 버튼을 처리한다. */
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
    } else if (kind === "expense") {
      await handleExpense(chatId, lines.slice(1))
    } else if (kind === "dispatch") {
      await handleDispatch(chatId, lines.slice(1))
    } else {
      await sendText(chatId, HELP)
    }
  } catch (error) {
    console.error("telegram webhook failed", error)
    await sendText(chatId, "⚠️ 처리 중 오류가 났어요. 등록됐는지 앱에서 확인해 주세요.").catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
