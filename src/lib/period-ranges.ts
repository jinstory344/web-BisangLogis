import { getMonthRange } from "@/lib/date"

/**
 * 기간 칸 나누기와 칸별 합계 (HOME 장부와 매출·지출·배차·차계부 보기가 함께 쓴다).
 */

/** 한 칸의 기간 (주별: "2026-11-2", 월별: "2026-11", 연별: "2026") */
export interface PeriodRange {
  key: string
  from: string
  to: string
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

/**
 * 한 달을 7일 단위 주차(1~7일=1주차, 8~14일=2주차 …)로 나눈다.
 * 오늘 이후에 시작하는 주차는 뺀다. 최근 주차가 먼저.
 */
export function weekRanges(monthAnchor: string, today: string): PeriodRange[] {
  const { from: monthFrom, to: monthTo } = getMonthRange(monthAnchor)
  const prefix = monthFrom.slice(0, 7)
  const lastDay = Number(monthTo.slice(8, 10))
  const ranges: PeriodRange[] = []
  for (let week = 1; week <= Math.ceil(lastDay / 7); week += 1) {
    const from = `${prefix}-${pad((week - 1) * 7 + 1)}`
    const to = `${prefix}-${pad(Math.min(week * 7, lastDay))}`
    if (from > today) continue
    ranges.push({ key: `${prefix}-${week}`, from, to })
  }
  return ranges.reverse()
}

/** 한 해의 1~12월. 오늘 이후의 달은 뺀다. 최근 달이 먼저. */
export function monthRanges(year: number, today: string): PeriodRange[] {
  const ranges: PeriodRange[] = []
  for (let month = 1; month <= 12; month += 1) {
    const { from, to } = getMonthRange(`${year}-${pad(month)}-01`)
    if (from > today) continue
    ranges.push({ key: `${year}-${pad(month)}`, from, to })
  }
  return ranges.reverse()
}

/** 가장 이른 기록의 해(기록이 없으면 올해)부터 올해까지 모든 해. 최근 해가 먼저. */
export function yearRanges(dates: readonly string[], today: string): PeriodRange[] {
  const currentYear = Number(today.slice(0, 4))
  let firstYear = currentYear
  for (const date of dates) firstYear = Math.min(firstYear, Number(date.slice(0, 4)))
  const ranges: PeriodRange[] = []
  for (let year = firstYear; year <= currentYear; year += 1) {
    ranges.push({ key: String(year), from: `${year}-01-01`, to: `${year}-12-31` })
  }
  return ranges.reverse()
}

/** 날짜와 합칠 금액들이 있는 한 줄 (예: { date, supply, unpaid }) */
export type MetricRow<K extends string> = { date: string } & Record<K, number>

export interface PeriodSums<K extends string> {
  count: number
  sums: Record<K, number>
}

export interface PeriodBucket<K extends string> extends PeriodRange, PeriodSums<K> {}

function emptySums<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>
}

/** 기간(from~to, 양끝 포함) 안의 줄 수와 금액 합 */
export function sumPeriod<K extends string>(
  rows: readonly MetricRow<K>[],
  keys: readonly K[],
  from: string,
  to: string
): PeriodSums<K> {
  const sums = emptySums(keys)
  let count = 0
  for (const row of rows) {
    if (row.date < from || row.date > to) continue
    count += 1
    for (const key of keys) sums[key] += row[key]
  }
  return { count, sums }
}

/** 주별(그 달)·월별(그 해)·연별(전체) 칸마다 합계. 최근 칸이 먼저. 오늘 뒤 칸은 기록이 있을 때까지만. */
export function buildPeriodBuckets<K extends string>(
  view: "week" | "month" | "year",
  anchor: string,
  rows: readonly MetricRow<K>[],
  keys: readonly K[],
  today: string
): PeriodBucket<K>[] {
  // 미리 넣어 둔 앞날짜 기록(예: 11/30 하이패스 청구)이 있으면 그 칸까지 보여 준다 — 칸 합 = 위 합계(PRD 4.3)
  let lastDay = today
  for (const row of rows) if (row.date > lastDay) lastDay = row.date
  const ranges =
    view === "week"
      ? weekRanges(anchor, lastDay)
      : view === "month"
        ? monthRanges(Number(anchor.slice(0, 4)), lastDay)
        : yearRanges([today, ...rows.map((row) => row.date)], lastDay)
  return ranges.map((range) => ({ ...range, ...sumPeriod(rows, keys, range.from, range.to) }))
}

/** 달력용: 날짜마다 줄 수와 금액 합 */
export function buildDailySums<K extends string>(
  rows: readonly MetricRow<K>[],
  keys: readonly K[]
): Record<string, PeriodSums<K>> {
  const byDate: Record<string, PeriodSums<K>> = {}
  for (const row of rows) {
    const bucket = (byDate[row.date] ??= { count: 0, sums: emptySums(keys) })
    bucket.count += 1
    for (const key of keys) bucket.sums[key] += row[key]
  }
  return byDate
}
