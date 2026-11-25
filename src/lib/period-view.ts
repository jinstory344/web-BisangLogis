import { formatYearMonth, getMonthRange, isAllPeriod, shiftMonthRange } from "@/lib/date"
import { getLedgerNeighborAnchors, getLedgerRange, parseLedgerView, type LedgerView } from "@/lib/ledger"

/**
 * 매출·지출·배차·차계부 화면의 보기(일일·달력·주별·월별·연별) 계산 — HOME 장부와 같은 규칙.
 * 주소는 기존 from·to·거르기 값을 그대로 쓰고 view만 더한다(일일이면 view 없음).
 * 일일이 아닌 보기의 기준일은 from(그 달 1일)이고, to는 그 달 말일로 둔다(일일로 돌아오면 그 달 목록).
 */

export { parseLedgerView as parseListView }
export type ListView = LedgerView

export * from "@/lib/period-ranges"

/** 보기가 다루는 기간 (일일·달력·주별 = 그 달, 월별 = 그 해, 연별 = 전체) */
export function getViewRange(view: ListView, anchor: string): { from: string; to: string } {
  return getLedgerRange(view, anchor)
}

/** 집계 카드 제목 앞부분: "2026년 11월" / "2026년" / "전체 기간" */
export function periodTitle(view: ListView, anchor: string): string {
  if (view === "month") return `${anchor.slice(0, 4)}년`
  if (view === "year") return "전체 기간"
  return formatYearMonth(anchor)
}

/** 거르기 줄 왼쪽 배지: "11월" / "2026년" / 연별은 없음("" — 옆 글자가 이미 "전체 N건") */
export function periodBadge(view: ListView, anchor: string): string {
  if (view === "month") return `${anchor.slice(0, 4)}년`
  if (view === "year") return ""
  return `${Number(anchor.slice(5, 7))}월`
}

export interface PreviousPeriod {
  from: string
  to: string
  /** "지난 달" / "작년" */
  label: string
  /** 대비 문구 앞말: "전월" / "작년" */
  rateWord: string
}

/** 집계 카드의 비교 기간: 달력(그 달) → 지난 달, 월별(그 해) → 작년, 연별·일일·주별 → 없음 */
export function previousPeriod(view: ListView, anchor: string): PreviousPeriod | null {
  if (view === "calendar") {
    return { ...shiftMonthRange(anchor, -1), label: "지난 달", rateWord: "전월" }
  }
  if (view === "month") {
    const year = Number(anchor.slice(0, 4)) - 1
    return { from: `${year}-01-01`, to: `${year}-12-31`, label: "작년", rateWord: "작년" }
  }
  return null
}

/** 주소 값(배열로 올 수도 있음)을 한 값으로 */
type ParamValue = string | string[] | null | undefined
export type ListParams = Record<string, ParamValue>

function firstValue(value: ParamValue): string {
  return (Array.isArray(value) ? value[0] : value) ?? ""
}

/**
 * 목록 화면 주소: 지금 주소의 거르기 값은 그대로 두고 보기·기간만 바꾼다(page는 지운다).
 * 일일 보기는 view를 빼서 예전 주소와 같게 둔다.
 */
export function listViewHref(
  pathname: string,
  params: ListParams,
  next: { view: ListView; from: string; to: string }
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    const text = firstValue(value)
    if (text && key !== "page" && key !== "view" && key !== "from" && key !== "to") search.set(key, text)
  }
  if (next.view !== "day") search.set("view", next.view)
  search.set("from", next.from)
  search.set("to", next.to)
  return `${pathname}?${search.toString()}`
}

/** 그 보기로, 기준일이 든 달로 (보기 메뉴·달 고르기·쓸어 넘기기) */
export function viewAnchorHref(pathname: string, params: ListParams, view: ListView, anchor: string): string {
  return listViewHref(pathname, params, { view, ...getMonthRange(anchor) })
}

/**
 * 주소의 from으로 보기 기준일을 정한다. 전체 기간(1970-01-01)·잘못된 값이면 fallback(이번 달 1일).
 */
export function listAnchor(from: string, to: string, fallback: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || isAllPeriod({ from, to })) return fallback
  return from
}

/**
 * 좌우로 쓸어 넘길 이웃 주소 (HOME과 같게: 달력·주별 = 달, 월별 = 해, 연별 = 없음).
 * 일일 보기는 쓰는 쪽(MonthSwipe)이 지금처럼 from 기준 달로 넘긴다.
 */
export function viewNeighborHrefs(
  pathname: string,
  params: ListParams,
  view: ListView,
  anchor: string
): { prev: string; next: string } | null {
  const neighbors = getLedgerNeighborAnchors(view, anchor)
  if (!neighbors) return null
  return {
    prev: viewAnchorHref(pathname, params, view, neighbors.prev),
    next: viewAnchorHref(pathname, params, view, neighbors.next),
  }
}

/**
 * 줄·칸을 눌렀을 때 갈 곳: 달력 날짜 → 그날만 일일, 주별·월별 줄 → 그 기간 일일, 연별 줄 → 그 해 월별.
 */
export function bucketTarget(
  view: ListView,
  range: { from: string; to: string }
): { view: ListView; from: string; to: string } {
  if (view === "year") return { view: "month", ...getMonthRange(range.from) }
  return { view: "day", from: range.from, to: range.to }
}

/** 머리 오른쪽 달력 아이콘: 일일·달력·주별 = 달 고르기(아이콘 안 달 숫자), 월별 = 해 고르기("26"), 연별 = 없음 */
export function viewPickerSpec(
  view: ListView,
  anchor: string
): { mode: "month" | "year"; iconText: string; label: string } | null {
  if (view === "year") return null
  if (view === "month") return { mode: "year", iconText: anchor.slice(2, 4), label: `${anchor.slice(0, 4)}년` }
  return { mode: "month", iconText: String(Number(anchor.slice(5, 7))), label: formatYearMonth(anchor) }
}
