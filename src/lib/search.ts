/** 검색어 최대 길이 */
export const SEARCH_MAX_LENGTH = 30

/**
 * 검색창에 넣은 글자를 DB 검색에 안전한 형태로 다듬는다.
 * PostgREST의 or 필터 문법을 깨는 글자(쉼표·괄호·따옴표·역슬래시)와 와일드카드(% * _)는 빼고,
 * 공백을 하나로 줄이고 앞뒤 공백을 지운 뒤 최대 길이로 자른다.
 */
export function normalizeSearchQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return ""
  return value
    .replace(/[,()"'\\%*_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SEARCH_MAX_LENGTH)
    .trim()
}

/** 여러 칸 중 하나라도 검색어를 포함하면 맞는 or 필터: `a.ilike.%q%,b.ilike.%q%` */
export function buildIlikeOrFilter(columns: readonly string[], query: string): string {
  return columns.map((column) => `${column}.ilike.%${query}%`).join(",")
}

/** 거래처 이름으로 찾은 id가 있으면 그 거래처에 연결된 건도 맞게 or 필터 끝에 붙인다. */
export function appendClientIdFilter(filter: string, clientIds: readonly string[]): string {
  return clientIds.length > 0 ? `${filter},client_id.in.(${clientIds.join(",")})` : filter
}

/** 통합검색 탭: 전체 · 매출 · 지출 · 배차 */
export type SearchTab = "all" | "sale" | "expense" | "dispatch"

export const SEARCH_TABS: { value: SearchTab; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "sale", label: "매출" },
  { value: "expense", label: "지출" },
  { value: "dispatch", label: "배차" },
]

/** 주소의 tab 값 → 탭. 모르는 값이면 전체. (예전 주소의 dispatch·ledger도 받는다) */
export function parseSearchTab(raw: string | string[] | undefined): SearchTab {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === "ledger") return "all"
  return SEARCH_TABS.some((t) => t.value === value) ? (value as SearchTab) : "all"
}

export type PeriodPreset = "all" | "thisMonth" | "lastMonth" | "last3Months" | "thisYear" | "lastYear"

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "thisMonth", label: "이번 달" },
  { value: "lastMonth", label: "지난달" },
  { value: "last3Months", label: "최근 3개월" },
  { value: "thisYear", label: "올해" },
  { value: "lastYear", label: "작년" },
]

function monthStart(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month - 1, 1))
  return d.toISOString().slice(0, 10)
}

function monthEnd(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

/** 빠른 기간 → 날짜 범위 (오늘은 서울 기준 YYYY-MM-DD). 전체면 null. */
export function presetRange(preset: PeriodPreset, today: string): { from: string; to: string } | null {
  const [y, m] = today.split("-").map(Number)
  switch (preset) {
    case "thisMonth":
      return { from: monthStart(y, m), to: monthEnd(y, m) }
    case "lastMonth":
      return { from: monthStart(y, m - 1), to: monthEnd(y, m - 1) }
    case "last3Months":
      return { from: monthStart(y, m - 2), to: monthEnd(y, m) }
    case "thisYear":
      return { from: `${y}-01-01`, to: `${y}-12-31` }
    case "lastYear":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
    default:
      return null
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 주소의 from·to → 기간 (둘 다 올바른 날짜일 때만, 앞뒤가 바뀌었으면 바로잡는다) */
export function parseSearchPeriod(
  from: string | string[] | undefined,
  to: string | string[] | undefined
): { from: string; to: string } | null {
  const a = Array.isArray(from) ? from[0] : from
  const b = Array.isArray(to) ? to[0] : to
  if (!a || !b || !DATE_RE.test(a) || !DATE_RE.test(b)) return null
  return a <= b ? { from: a, to: b } : { from: b, to: a }
}

/** 기간 칩 글자: 빠른 기간과 같으면 그 이름, 아니면 "10/20 ~ 11/15" (해가 다르면 연도까지) */
export function periodLabel(period: { from: string; to: string } | null, today: string): string {
  if (!period) return "기간"
  const preset = PERIOD_PRESETS.find((p) => {
    const r = presetRange(p.value, today)
    return r && r.from === period.from && r.to === period.to
  })
  if (preset) return preset.label
  const short = (d: string) => {
    const [y, m, day] = d.split("-")
    return y === today.slice(0, 4) ? `${Number(m)}/${Number(day)}` : `${y.slice(2)}/${Number(m)}/${Number(day)}`
  }
  return `${short(period.from)} ~ ${short(period.to)}`
}

/** 찾은 배차들의 운임·수수료 합계 (운임이 비어 있는 건은 0으로 친다) */
export function sumDispatchTotals(
  rows: readonly { freight_amount: number | null; fee_amount: number }[]
): { freight: number; fee: number } {
  return rows.reduce(
    (sum, row) => ({
      freight: sum.freight + (row.freight_amount ?? 0),
      fee: sum.fee + row.fee_amount,
    }),
    { freight: 0, fee: 0 }
  )
}

/** 검색 결과 한 줄의 날짜: "2026-10-02" → "2026. 10. 2." (가계부 앱처럼 연도까지) */
export function formatSearchDate(date: string): string {
  const [year, month, day] = date.split("-")
  return `${year}. ${Number(month)}. ${Number(day)}.`
}

export interface MonthGroup<T> {
  /** "2026-11" */
  month: string
  /** "2026년 11월" */
  label: string
  rows: T[]
}

/** 최근 날짜부터 정렬된 결과를 달별로 묶는다 (들어온 순서를 그대로 지킨다). */
export function groupByMonth<T>(rows: readonly T[], dateOf: (row: T) => string): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = []
  for (const row of rows) {
    const month = dateOf(row).slice(0, 7)
    let group = groups.at(-1)
    if (!group || group.month !== month) {
      group = { month, label: `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`, rows: [] }
      groups.push(group)
    }
    group.rows.push(row)
  }
  return groups
}

/** 통합검색 주소 (빈 값은 뺀다) */
export function searchHref(
  query: string,
  tab: string,
  period: { from: string; to: string } | null
): string {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (tab && tab !== "all") params.set("tab", tab)
  if (period) {
    params.set("from", period.from)
    params.set("to", period.to)
  }
  const text = params.toString()
  return text ? `/search?${text}` : "/search"
}

/** 기간 안에 드는지 (기간이 없으면 전부) */
export function inPeriod(date: string, period: { from: string; to: string } | null): boolean {
  return !period || (date >= period.from && date <= period.to)
}

/** 날짜 목록 → 달별 건수 {"2026-11": 13} (기간 판의 월별 막대용) */
export function countByMonth(dates: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const date of dates) {
    const month = date.slice(0, 7)
    counts[month] = (counts[month] ?? 0) + 1
  }
  return counts
}
