import { expensePaymentLabel } from "@/lib/constants/payment-method"
import type { ExpensePaymentMethod } from "@/lib/supabase/database.types"

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
  /** 결제수단 (예전 테스트 자료 등 없으면 표시 안 함) */
  payment_method?: ExpensePaymentMethod | null
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
  /** 지출의 결제수단 (car_log면 null) */
  paymentMethod: ExpensePaymentMethod | null
  /** 돈이 나간 회차들 (할부면 회차마다, 아니면 하나) — 날짜별 목록은 회차 금액으로 보여 준다 */
  parts: CarEntryPart[]
  /** 할부 개월 수 (일시불·car_log면 null) */
  installmentMonths: number | null
  items: CarServiceLine[]
}

export interface CarEntryPart {
  date: string
  amount: number
  /** 할부 회차 (일시불이면 null) */
  no: number | null
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
      paymentMethod: first.payment_method ?? null,
      parts: sorted.map((row) => ({
        date: row.expense_date,
        amount: Number(row.amount),
        no: isGroup ? row.installment_no : null,
      })),
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
    paymentMethod: null,
    parts: [{ date: row.log_date, amount: Number(row.amount), no: null }],
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

/** 날짜별 목록의 한 줄: 기록의 한 회차 (할부가 아니면 기록 그대로) */
export interface CarEntryRow {
  key: string
  entry: CarEntry
  date: string
  /** 이 줄 금액 (할부면 회차 금액). 항목 이력처럼 금액이 빈칸이면 null */
  amount: number | null
  /** 할부 회차 (일시불·묶음 전체면 null) */
  installmentNo: number | null
  /** 항목 이력: 직전 기록과의 km 차이 */
  diffKm?: number | null
}

/**
 * from~to에 돈이 나간 회차들을 날짜별 목록 줄로 (지출 목록과 같은 기준: 할부는 그 달 회차 금액·"할부 3/6").
 * 최근 날짜부터(같은 날이면 km 큰 것 먼저).
 */
export function entryRowsInRange(entries: readonly CarEntry[], from: string, to: string): CarEntryRow[] {
  const rows = entries.flatMap((entry) =>
    entry.parts
      .filter((part) => part.date >= from && part.date <= to)
      .map((part) => ({
        key: `${entry.key}:${part.date}:${part.no ?? 0}`,
        entry,
        date: part.date,
        amount: part.amount,
        installmentNo: part.no,
      }))
  )
  return rows.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.entry.km ?? -1) - (a.entry.km ?? -1) ||
      a.key.localeCompare(b.key)
  )
}

/** 금액 아래 결제수단: 지출 목록과 같은 "카드 · 신한카드 · 할부 3/6" (회차가 없으면 "6개월 할부") */
export function carEntryPaymentLabel(
  entry: Pick<CarEntry, "paymentMethod" | "cardName" | "installmentMonths">,
  installmentNo: number | null
): string {
  return expensePaymentLabel({
    payment_method: entry.paymentMethod,
    card_name: entry.cardName,
    installment_no: installmentNo,
    installment_months: entry.installmentMonths,
  })
}
