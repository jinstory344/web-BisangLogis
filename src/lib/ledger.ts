import { getMonthRange } from "@/lib/date"

/** 장부 보기: 일일(월 안의 날짜별) · 주별(월 안의 주차별) · 월별(연 안의 월별) · 연별(전체 연도별) */
export type LedgerView = "day" | "week" | "month" | "year"

export const LEDGER_VIEWS: readonly { value: LedgerView; label: string }[] = [
  { value: "day", label: "일일" },
  { value: "week", label: "주별" },
  { value: "month", label: "월별" },
  { value: "year", label: "연별" },
]

/** `?view=` 값을 검증한다. 알 수 없는 값이면 기본 보기(일일). */
export function parseLedgerView(raw: string | string[] | undefined): LedgerView {
  const value = Array.isArray(raw) ? raw[0] : raw
  return LEDGER_VIEWS.some((view) => view.value === value)
    ? (value as LedgerView)
    : "day"
}

/**
 * 금액 한 건. 매출은 income(공급가액), 지출은 expense로 넣는다.
 * 배차의 운임·수수료는 매출과 따로 관리해서 장부에 넣지 않는다.
 */
export interface AmountRow {
  /** yyyy-MM-dd */
  date: string
  income: number
  expense: number
}

export interface LedgerTotals {
  income: number
  expense: number
  /** 매출 − 지출 */
  net: number
}

export function sumTotals(rows: readonly AmountRow[]): LedgerTotals {
  let income = 0
  let expense = 0
  for (const row of rows) {
    income += row.income
    expense += row.expense
  }
  return { income, expense, net: income - expense }
}

/** 일일 장부에 보여 줄 한 줄 (매출 또는 지출 한 건) */
export interface LedgerEntry {
  kind: "sale" | "expense"
  id: string
  /** yyyy-MM-dd */
  date: string
  createdAt: string
  amount: number
}

export interface DayBucket<T extends LedgerEntry> extends LedgerTotals {
  date: string
  /** 그날의 건들 (최근 등록이 위) */
  entries: T[]
}

/**
 * 건들을 날짜별로 묶는다 (최근 날짜가 먼저). 날짜마다 매출·지출 합계와 차액을 구하고,
 * 같은 날 안에서는 최근에 등록한 건이 위에 온다.
 */
export function buildDayBuckets<T extends LedgerEntry>(
  entries: readonly T[]
): DayBucket<T>[] {
  const byDate = new Map<string, DayBucket<T>>()

  for (const entry of entries) {
    let bucket = byDate.get(entry.date)
    if (!bucket) {
      bucket = { date: entry.date, income: 0, expense: 0, net: 0, entries: [] }
      byDate.set(entry.date, bucket)
    }
    if (entry.kind === "sale") bucket.income += entry.amount
    else bucket.expense += entry.amount
    bucket.net = bucket.income - bucket.expense
    bucket.entries.push(entry)
  }

  return [...byDate.values()]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((bucket) => ({
      ...bucket,
      entries: [...bucket.entries].sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
      ),
    }))
}

/** 주별·월별·연별 장부의 한 칸 */
export interface RangeBucket extends LedgerTotals {
  /** 주별: "2026-11-2", 월별: "2026-11", 연별: "2026" */
  key: string
  from: string
  to: string
  /** 이 기간의 건수 */
  count: number
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

function sumRange(
  rows: readonly AmountRow[],
  from: string,
  to: string
): LedgerTotals & { count: number } {
  const inRange = rows.filter((row) => row.date >= from && row.date <= to)
  return { ...sumTotals(inRange), count: inRange.length }
}

/**
 * 한 달을 7일 단위 주차(1~7일=1주차, 8~14일=2주차 …)로 나눠 주차별 합계를 구한다.
 * 목록 화면의 "M월 N주차"와 같은 구분이다. 오늘 이후에 시작하는 주차는 뺀다. 최근 주차가 먼저.
 */
export function buildWeekBuckets(
  monthAnchor: string,
  rows: readonly AmountRow[],
  today: string
): RangeBucket[] {
  const { from: monthFrom, to: monthTo } = getMonthRange(monthAnchor)
  const prefix = monthFrom.slice(0, 7)
  const lastDay = Number(monthTo.slice(8, 10))
  const weekCount = Math.ceil(lastDay / 7)
  const buckets: RangeBucket[] = []

  for (let week = 1; week <= weekCount; week += 1) {
    const from = `${prefix}-${pad((week - 1) * 7 + 1)}`
    const to = `${prefix}-${pad(Math.min(week * 7, lastDay))}`
    if (from > today) continue
    buckets.push({ key: `${prefix}-${week}`, from, to, ...sumRange(rows, from, to) })
  }

  return buckets.reverse()
}

/** 한 해의 월별 합계. 오늘 이후의 달은 뺀다. 최근 달이 먼저. */
export function buildMonthBuckets(
  year: number,
  rows: readonly AmountRow[],
  today: string
): RangeBucket[] {
  const buckets: RangeBucket[] = []

  for (let month = 1; month <= 12; month += 1) {
    const { from, to } = getMonthRange(`${year}-${pad(month)}-01`)
    if (from > today) continue
    buckets.push({ key: `${year}-${pad(month)}`, from, to, ...sumRange(rows, from, to) })
  }

  return buckets.reverse()
}

/**
 * 연도별 합계: 가장 이른 기록의 해(기록이 없으면 올해)부터 올해까지 모든 해를 넣는다 (기록 없는 해도 0으로).
 * 최근 해가 먼저.
 */
export function buildYearBuckets(
  rows: readonly AmountRow[],
  today: string
): RangeBucket[] {
  const currentYear = Number(today.slice(0, 4))
  const years = rows.map((row) => Number(row.date.slice(0, 4)))
  const firstYear = Math.min(currentYear, ...years)
  const buckets: RangeBucket[] = []

  for (let year = firstYear; year <= currentYear; year += 1) {
    const from = `${year}-01-01`
    const to = `${year}-12-31`
    buckets.push({ key: String(year), from, to, ...sumRange(rows, from, to) })
  }

  return buckets.reverse()
}

/** 주별 칸의 이름: "2주차 11/8~11/14" */
export function formatWeekBucketLabel(bucket: RangeBucket): string {
  const week = Number(bucket.key.split("-")[2])
  const [, fromMonth, fromDay] = bucket.from.split("-").map(Number)
  const [, toMonth, toDay] = bucket.to.split("-").map(Number)
  return `${week}주차 ${fromMonth}/${fromDay}~${toMonth}/${toDay}`
}

/** 월별 칸의 이름: "11월" */
export function formatMonthBucketLabel(bucket: RangeBucket): string {
  return `${Number(bucket.key.split("-")[1])}월`
}

/** `?d=` 기준 날짜를 검증한다: yyyy-MM-dd이면서 실제로 있는 날짜일 때만 그대로, 아니면 fallback. */
export function parseAnchorDate(
  raw: string | string[] | undefined,
  fallback: string
): string {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim()
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const exists =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  return exists ? value : fallback
}

/** 보기별로 장부가 다루는 기간: 일일·주별은 기준일이 속한 달, 월별은 그 해, 연별은 전체. */
export function getLedgerRange(
  view: LedgerView,
  anchor: string
): { from: string; to: string } {
  if (view === "day" || view === "week") return getMonthRange(anchor)
  if (view === "month") {
    const year = anchor.slice(0, 4)
    return { from: `${year}-01-01`, to: `${year}-12-31` }
  }
  return { from: "1970-01-01", to: "2099-12-31" }
}
