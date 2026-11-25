/**
 * 차계부 주소: `/car-ledger?car=<id>&from=YYYY-MM-01&to=YYYY-MM-말일&tab=service|cycle|<종류>&item=<항목>`.
 * 달은 매출·지출 목록과 같은 from·to를 써서 달 이동·쓸어 넘기기 부품을 그대로 쓴다.
 */

import { formatMonthDay, getMonthRange, type DateRange } from "@/lib/date"
import { parseAnchorDate } from "@/lib/ledger"

export const CAR_LEDGER_PATH = "/car-ledger"

/** 탭 값: 정비 · 교체 주기 · 그 밖의 종류 이름(주유·요소수·세차…) */
export const SERVICE_TAB = "service"
export const CYCLE_TAB = "cycle"
/** 11월 이전 정비 기록(엑셀에서 옮긴 보기 전용 목록) */
export const HISTORY_TAB = "history"

export interface CarLedgerQuery {
  car?: string | null
  /** 보기 (일일이면 없음) */
  view?: string | null
  from?: string | null
  to?: string | null
  tab?: string | null
  item?: string | null
}

export function carLedgerHref(query: CarLedgerQuery): string {
  const params = new URLSearchParams()
  for (const key of ["car", "view", "from", "to", "tab", "item"] as const) {
    const value = query[key]
    if (value) params.set(key, value)
  }
  const text = params.toString()
  return text ? `${CAR_LEDGER_PATH}?${text}` : CAR_LEDGER_PATH
}

/** 첫 값만 (배열로 온 쿼리) */
export function firstParam(raw: string | string[] | undefined): string {
  return (Array.isArray(raw) ? raw[0] : raw) ?? ""
}

/** 차계부 ＋ → 지출 등록 화면 (차량 › 정비/주유비/요소수 미리 채움, 저장하면 차계부로) */
export function newCarExpenseHref(minor: string, returnTo: string): string {
  const params = new URLSearchParams({ type: "expense", major: "차량", minor, returnTo })
  return `/new?${params.toString()}`
}

/** 차계부 기록 등록 화면 */
export function newCarLogHref(carId: string, kind: string, returnTo: string): string {
  const params = new URLSearchParams({ car: carId, kind, returnTo })
  return `${CAR_LEDGER_PATH}/new?${params.toString()}`
}

/**
 * 차계부 일일(탭) 화면의 기간: 보통은 from이 든 달 전체. 달력 날짜·주별 줄에서 들어오면 그 달 안의 짧은 기간
 * (from~to가 같은 달 안일 때만 — 다른 달로 넘어가거나 잘못된 값이면 그 달 전체).
 */
export function carDayPeriod(
  fromRaw: string,
  toRaw: string,
  fallbackFrom: string
): DateRange & { isMonth: boolean; label: string } {
  const from = parseAnchorDate(fromRaw, fallbackFrom)
  const month = getMonthRange(from)
  const to = parseAnchorDate(toRaw, month.to)
  if (to < from || to > month.to || (from === month.from && to === month.to)) {
    return { ...month, isMonth: true, label: `${Number(month.from.slice(5, 7))}월` }
  }
  return {
    from,
    to,
    isMonth: false,
    label: from === to ? formatMonthDay(from) : `${formatMonthDay(from)}~${formatMonthDay(to)}`,
  }
}
