import { CAR_EXPENSE_MINOR_TO_KIND } from "./constants"

/**
 * 차계부 기록 정규화: 지출(트럭) 줄과 car_logs(승용차 등) 줄을 같은 모양(CarEntry)으로 바꾼다.
 * - 할부 지출은 묶음 하나를 기록 하나로 합친다(첫 회차 날짜, 묶음 총액, 1회차의 리터·km).
 * - 정비 항목 줄(car_service_items)은 부모(지출 1회차 또는 car_log)에 붙인다.
 */

export interface CarExpenseInput {
  id: string
  expense_date: string
  category_minor: string
  amount: number
  installment_group_id: string | null
  installment_no: number | null
  installment_months: number | null
  card_name: string | null
  liters: number | null
  odometer_km: number | null
  vendor: string | null
  memo: string | null
}

export interface CarLogInput {
  id: string
  log_date: string
  kind: string
  amount: number
  liters: number | null
  odometer_km: number | null
  vendor: string | null
  memo: string | null
}

export interface ServiceItemInput {
  expense_id: string | null
  car_log_id: string | null
  item: string
  amount: number | null
  sort_order: number
}

export interface CarServiceLine {
  item: string
  /** 빈칸이면 null */
  amount: number | null
}

export interface CarEntry {
  /** 화면 key: "expense:<id>" / "log:<id>" */
  key: string
  source: "expense" | "log"
  /** 지출이면 첫 회차 줄 id, car_log면 그 id */
  id: string
  date: string
  /** 돈이 나간 날들(할부면 회차 날짜들, 아니면 date 하나) — 달 목록은 이 중 하나라도 그 달이면 보여 준다 */
  dates: string[]
  /** 정비·주유·요소수·세차 … */
  kind: string
  /** 총액(할부 묶음은 합계) */
  amount: number
  liters: number | null
  km: number | null
  vendor: string | null
  memo: string | null
  /** 지출의 카드 이름 */
  cardName: string | null
  /** 할부 개월 수 (일시불·car_log면 null) */
  installmentMonths: number | null
  items: CarServiceLine[]
}

/** 달 합계용 한 줄 (할부는 회차 줄 그대로) */
export interface CarAmountRow {
  date: string
  kind: string
  amount: number
}

function linesOf(items: readonly ServiceItemInput[]): CarServiceLine[] {
  return [...items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({ item: row.item, amount: row.amount === null ? null : Number(row.amount) }))
}

function groupBy<T>(rows: readonly T[], keyOf: (row: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyOf(row)
    if (key === null) continue
    const list = map.get(key)
    if (list) list.push(row)
    else map.set(key, [row])
  }
  return map
}

export function expenseKindOf(minor: string): string {
  return CAR_EXPENSE_MINOR_TO_KIND[minor] ?? minor
}

/** 지출 줄들 → 차계부 기록 (할부 묶음은 하나로) */
export function expensesToCarEntries(
  rows: readonly CarExpenseInput[],
  serviceItems: readonly ServiceItemInput[]
): CarEntry[] {
  const itemsByExpense = groupBy(serviceItems, (row) => row.expense_id)
  const groups = groupBy(rows, (row) => row.installment_group_id ?? row.id)

  return [...groups.values()].map((groupRows) => {
    const sorted = [...groupRows].sort(
      (a, b) => (a.installment_no ?? 0) - (b.installment_no ?? 0) || a.expense_date.localeCompare(b.expense_date)
    )
    const first = sorted[0]
    const isGroup = first.installment_group_id !== null
    // 항목 줄은 1회차에 붙지만, 혹시 다른 회차에 붙어 있어도 놓치지 않게 회차 순서대로 모은다
    const items = sorted.flatMap((row) => linesOf(itemsByExpense.get(row.id) ?? []))
    return {
      key: `expense:${first.id}`,
      source: "expense" as const,
      id: first.id,
      date: first.expense_date,
      dates: sorted.map((row) => row.expense_date),
      kind: expenseKindOf(first.category_minor),
      amount: sorted.reduce((sum, row) => sum + Number(row.amount), 0),
      liters: sorted.find((row) => row.liters !== null)?.liters ?? null,
      km: sorted.find((row) => row.odometer_km !== null)?.odometer_km ?? null,
      vendor: first.vendor,
      memo: first.memo,
      cardName: first.card_name,
      installmentMonths: isGroup ? (first.installment_months ?? sorted.length) : null,
      items,
    }
  })
}

/** car_logs 줄들 → 차계부 기록 */
export function carLogsToEntries(
  rows: readonly CarLogInput[],
  serviceItems: readonly ServiceItemInput[]
): CarEntry[] {
  const itemsByLog = groupBy(serviceItems, (row) => row.car_log_id)
  return rows.map((row) => ({
    key: `log:${row.id}`,
    source: "log" as const,
    id: row.id,
    date: row.log_date,
    dates: [row.log_date],
    kind: row.kind,
    amount: Number(row.amount),
    liters: row.liters === null ? null : Number(row.liters),
    km: row.odometer_km,
    vendor: row.vendor,
    memo: row.memo,
    cardName: null,
    installmentMonths: null,
    items: linesOf(itemsByLog.get(row.id) ?? []),
  }))
}

/** 달·올해 합계용 줄: 지출은 회차 줄 그대로(지출 목록과 같은 기준) */
export function toAmountRows(
  expenses: readonly CarExpenseInput[],
  logs: readonly CarLogInput[]
): CarAmountRow[] {
  return [
    ...expenses.map((row) => ({
      date: row.expense_date,
      kind: expenseKindOf(row.category_minor),
      amount: Number(row.amount),
    })),
    ...logs.map((row) => ({ date: row.log_date, kind: row.kind, amount: Number(row.amount) })),
  ]
}

/** 최근 날짜부터 (같은 날이면 km 큰 것 먼저) */
export function sortEntriesDesc<T extends Pick<CarEntry, "date" | "km" | "key">>(entries: readonly T[]): T[] {
  return [...entries].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || (b.km ?? -1) - (a.km ?? -1) || a.key.localeCompare(b.key)
  )
}
