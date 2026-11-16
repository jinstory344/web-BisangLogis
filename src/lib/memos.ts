import { CARGO_BOX_TYPE_LABELS } from "@/lib/constants/cargo-box-type"
import type { DispatchRow, MemoRow } from "@/lib/supabase/database.types"

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

/** 180000 → "18만원", 185000 → "18만5천원", 123456 → "123,456원" */
export function formatManwon(amount: number): string {
  if (amount % 1000 !== 0 || amount < 10000) return `${amount.toLocaleString("ko-KR")}원`
  const man = Math.floor(amount / 10000)
  const cheon = (amount % 10000) / 1000
  return `${man.toLocaleString("ko-KR")}만${cheon ? `${cheon}천` : ""}원`
}

/** "냉동3p" — 차종(냉동탑은 "냉동"으로 줄임) + 파렛 수 + 톤 */
function cargoLine(dispatch: DispatchRow): string {
  const box = dispatch.cargo_box_type
    ? CARGO_BOX_TYPE_LABELS[dispatch.cargo_box_type].replace(/탑$/, "") || "탑"
    : ""
  const pallet = dispatch.pallet_count ? `${dispatch.pallet_count}p` : ""
  const ton = dispatch.weight_ton ? ` ${dispatch.weight_ton}톤` : ""
  return `${box}${pallet}${ton}`.trim()
}

/**
 * 거래처에게 보내는 배차정보 문구.
 * [11월 17일 화요일] / 경로 / 냉동3p / 차량번호 / 차주 / 전화 / 운임18만원 — 빈 칸은 줄째로 뺀다.
 */
export function buildDispatchInfo(dispatch: DispatchRow): string {
  const [, m, d] = dispatch.dispatch_date.split("-").map(Number)
  const weekday = WEEKDAYS[new Date(`${dispatch.dispatch_date}T00:00:00Z`).getUTCDay()]
  const lines = [
    `[${m}월 ${d}일 ${weekday}요일]`,
    `${dispatch.origin} - ${dispatch.destination}`,
    cargoLine(dispatch),
    dispatch.plate_no_snapshot?.trim(),
    dispatch.driver_name_snapshot?.trim(),
    dispatch.driver_phone_snapshot?.replace(/\D/g, ""),
    dispatch.freight_amount != null ? `운임${formatManwon(dispatch.freight_amount)}` : "",
  ]
  return lines.filter(Boolean).join("\n")
}

const squash = (text: string) => text.replace(/[\s\-→~>·,]/g, "").toLowerCase()

/**
 * 배차 경로와 가장 잘 맞는 배차메모. 제목에 상차지·하차지가 둘 다 들어 있으면 먼저,
 * 하차지만 맞으면 그다음. 거래처 메모가 공통 메모보다 앞선다. 맞는 게 없으면 null.
 */
export function matchRouteMemo(
  memos: readonly Pick<MemoRow, "id" | "title" | "client_id">[],
  origin: string,
  destination: string
): string | null {
  const o = squash(origin)
  const d = squash(destination)
  let best: { id: string; score: number } | null = null
  for (const memo of memos) {
    const t = squash(memo.title)
    const score =
      (d && t.includes(d) ? 2 : 0) + (o && t.includes(o) ? 1 : 0) + (memo.client_id ? 0.5 : 0)
    if (score >= 2 && (!best || score > best.score)) best = { id: memo.id, score }
  }
  return best?.id ?? null
}

/** 문자 앱을 받는 사람·내용이 채워진 채로 여는 주소. 아이폰은 "&body=", 그 밖은 "?body=". */
export function smsHref(phone: string | null | undefined, body: string, isIOS: boolean): string {
  const to = (phone ?? "").replace(/[^\d+]/g, "")
  return `sms:${to}${isIOS ? "&" : "?"}body=${encodeURIComponent(body)}`
}

/** 메모 정렬: 고정(★) 먼저, 그다음 최근에 고친 순 */
export function sortMemos<T extends Pick<MemoRow, "pinned" | "created_at" | "updated_at">>(
  memos: readonly T[]
): T[] {
  const time = (m: T) => m.updated_at ?? m.created_at
  return [...memos].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || time(b).localeCompare(time(a))
  )
}
