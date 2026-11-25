import { unitPrice } from "./constants"
import { sortEntriesDesc, type CarAmountRow, type CarEntry } from "./entries"

/** 기간 안의 기록인지 (yyyy-MM-dd 글자 비교) */
export function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to
}

export interface KindTotal {
  kind: string
  total: number
}

/**
 * 기간 안의 종류별 합계. kindOrder의 종류는 0원이어도 넣고, 목록에 없는 종류(지운 종류의 옛 기록)는
 * 금액이 있을 때만 뒤에 붙인다.
 */
export function kindTotals(
  rows: readonly CarAmountRow[],
  from: string,
  to: string,
  kindOrder: readonly string[]
): { total: number; byKind: KindTotal[] } {
  const totals = new Map<string, number>(kindOrder.map((kind) => [kind, 0]))
  let total = 0
  for (const row of rows) {
    if (!inRange(row.date, from, to)) continue
    totals.set(row.kind, (totals.get(row.kind) ?? 0) + row.amount)
    total += row.amount
  }
  const byKind = [...totals.entries()]
    .filter(([kind, sum]) => kindOrder.includes(kind) || sum !== 0)
    .map(([kind, sum]) => ({ kind, total: sum }))
  return { total, byKind }
}

/** 한 해 합계 */
export function yearTotal(rows: readonly CarAmountRow[], year: string): number {
  return rows.reduce((sum, row) => (row.date.startsWith(`${year}-`) ? sum + row.amount : sum), 0)
}

export interface ItemCount {
  item: string
  count: number
  /** 항목 줄 금액 합 (빈칸은 0으로) */
  total: number
}

/** 정비 기록들에서 항목별 횟수·합계 (많이 한 순, 같으면 합계 큰 순, 이름 순) */
export function serviceItemCounts(entries: readonly CarEntry[]): ItemCount[] {
  const map = new Map<string, ItemCount>()
  for (const entry of entries) {
    // 한 기록에 같은 항목이 두 줄이어도 횟수는 한 번
    const seen = new Set<string>()
    for (const line of entry.items) {
      let count = map.get(line.item)
      if (!count) {
        count = { item: line.item, count: 0, total: 0 }
        map.set(line.item, count)
      }
      if (!seen.has(line.item)) {
        count.count += 1
        seen.add(line.item)
      }
      count.total += line.amount ?? 0
    }
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || b.total - a.total || a.item.localeCompare(b.item, "ko")
  )
}

/** 이 기록에서 그 항목 줄 금액 합 (모두 빈칸이면 null) */
export function itemAmountIn(entry: CarEntry, item: string): number | null {
  const lines = entry.items.filter((line) => line.item === item)
  if (lines.every((line) => line.amount === null)) return null
  return lines.reduce((sum, line) => sum + (line.amount ?? 0), 0)
}

export interface ItemHistoryRow {
  entry: CarEntry
  /** 그 항목 줄 금액 (빈칸이면 null — 정비 총액으로 채우지 않는다) */
  amount: number | null
  /** 직전(더 오래된) km 기록과의 차이 */
  diffKm: number | null
}

export interface ItemHistory {
  item: string
  count: number
  total: number
  /** km 있는 연속 기록 차이의 평균 (반올림). 차이가 하나도 없으면 null */
  averageIntervalKm: number | null
  /** 최근 날짜부터 */
  rows: ItemHistoryRow[]
}

/** 한 항목의 전체 기간 이력 */
export function itemHistory(entries: readonly CarEntry[], item: string): ItemHistory {
  const matched = sortEntriesDesc(entries.filter((entry) => entry.items.some((line) => line.item === item)))
  // 오래된 것부터 km 차이를 잰다
  const ascending = [...matched].reverse()
  const diffs = new Map<string, number>()
  const intervals: number[] = []
  let prevKm: number | null = null
  for (const entry of ascending) {
    if (entry.km === null) continue
    if (prevKm !== null) {
      const diff = entry.km - prevKm
      diffs.set(entry.key, diff)
      // 거꾸로 적힌 km(입력 실수)는 평균에서 뺀다
      if (diff > 0) intervals.push(diff)
    }
    prevKm = entry.km
  }

  const rows = matched.map((entry) => ({
    entry,
    amount: itemAmountIn(entry, item),
    diffKm: diffs.get(entry.key) ?? null,
  }))
  return {
    item,
    count: rows.length,
    total: rows.reduce((sum, row) => sum + (row.amount ?? 0), 0),
    averageIntervalKm:
      intervals.length > 0 ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length) : null,
    rows,
  }
}

export interface CycleInput {
  id: string
  item: string
  cycle_km: number | null
  manual_date: string | null
  manual_km: number | null
  sort_order: number
}

export interface CycleRowView {
  id: string
  item: string
  cycleKm: number | null
  /** 최근 교체일 (직접 고친 값이 있으면 그것) */
  lastDate: string | null
  /** 최근 교체 km */
  lastKm: number | null
  /** 직접 고친 값인지 */
  isManual: boolean
  /** 교체 km + 주기 (둘 다 있을 때만) */
  nextKm: number | null
}

/** 그 항목 정비 줄 중 가장 최근 것 (날짜 기준, 같은 날이면 km 큰 것) */
export function latestItemRecord(
  entries: readonly CarEntry[],
  item: string
): { date: string; km: number | null } | null {
  const latest = sortEntriesDesc(entries.filter((entry) => entry.items.some((line) => line.item === item)))[0]
  return latest ? { date: latest.date, km: latest.km } : null
}

/**
 * 교체 주기 표 한 줄씩. 교체일·교체 km는 직접 고친 값(manual)이 하나라도 있으면 그 두 값,
 * 없으면 그 차의 그 항목 정비 기록 중 가장 최근 것(km는 그 기록의 km).
 */
export function buildCycleRows(cycles: readonly CycleInput[], entries: readonly CarEntry[]): CycleRowView[] {
  return [...cycles]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((cycle) => {
      const isManual = cycle.manual_date !== null || cycle.manual_km !== null
      const auto = isManual ? null : latestItemRecord(entries, cycle.item)
      const lastDate = isManual ? cycle.manual_date : (auto?.date ?? null)
      const lastKm = isManual ? cycle.manual_km : (auto?.km ?? null)
      return {
        id: cycle.id,
        item: cycle.item,
        cycleKm: cycle.cycle_km,
        lastDate,
        lastKm,
        isManual,
        nextKm: lastKm !== null && cycle.cycle_km !== null ? lastKm + cycle.cycle_km : null,
      }
    })
}

export interface KindSummary {
  count: number
  total: number
  /** 리터를 적은 기록들의 리터 합 */
  liters: number
  /** 리터 적은 기록들의 평균 단가(원/L). 없으면 null */
  unitPrice: number | null
}

/** 주유·요소수 탭 위 카드 두 개의 값 (기간 안, 그 종류만) */
export function kindSummary(
  entries: readonly CarEntry[],
  kind: string,
  from: string,
  to: string
): KindSummary {
  let count = 0
  let total = 0
  let liters = 0
  let literAmount = 0
  for (const entry of entries) {
    if (entry.kind !== kind || !inRange(entry.date, from, to)) continue
    count += 1
    total += entry.amount
    if (entry.liters !== null && entry.liters > 0) {
      liters += entry.liters
      literAmount += entry.amount
    }
  }
  return {
    count,
    total,
    liters: Math.round(liters * 10) / 10,
    unitPrice: unitPrice(literAmount, liters > 0 ? liters : null),
  }
}
