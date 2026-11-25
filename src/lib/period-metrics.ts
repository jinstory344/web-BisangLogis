import type { MetricRow } from "@/lib/period-ranges"

/**
 * 매출·지출·배차·차계부 보기(달력·주별·월별·연별)에 넣는 금액 줄 — 목록 합계 줄과 같은 기준.
 * 매출: 공급가액(입금·미입금으로도 나눔) / 지출: 금액(할부는 회차 줄 금액) / 배차: 운임·수수료(운임 없으면 0) / 차계부: 금액.
 */

export const SALE_METRIC_KEYS = ["supply", "paid", "unpaid"] as const
export type SaleMetricKey = (typeof SALE_METRIC_KEYS)[number]

export function saleMetricRows(
  rows: readonly { sale_date: string; supply_amount: number; payment_status: string }[]
): MetricRow<SaleMetricKey>[] {
  return rows.map((row) => {
    const paid = row.payment_status === "PAID"
    return {
      date: row.sale_date,
      supply: row.supply_amount,
      paid: paid ? row.supply_amount : 0,
      unpaid: paid ? 0 : row.supply_amount,
    }
  })
}

export const AMOUNT_METRIC_KEYS = ["amount"] as const
export type AmountMetricKey = (typeof AMOUNT_METRIC_KEYS)[number]

export function expenseMetricRows(
  rows: readonly { expense_date: string; amount: number }[]
): MetricRow<AmountMetricKey>[] {
  return rows.map((row) => ({ date: row.expense_date, amount: row.amount }))
}

export function carMetricRows(
  rows: readonly { date: string; amount: number }[]
): MetricRow<AmountMetricKey>[] {
  return rows.map((row) => ({ date: row.date, amount: row.amount }))
}

export const DISPATCH_METRIC_KEYS = ["freight", "fee"] as const
export type DispatchMetricKey = (typeof DISPATCH_METRIC_KEYS)[number]

export function dispatchMetricRows(
  rows: readonly { dispatch_date: string; freight_amount: number | null; fee_amount: number }[]
): MetricRow<DispatchMetricKey>[] {
  return rows.map((row) => ({
    date: row.dispatch_date,
    freight: row.freight_amount ?? 0,
    fee: row.fee_amount,
  }))
}

/** 날짜가 from~to(양끝 포함)인 줄만 */
export function rowsInPeriod<T>(
  rows: readonly T[],
  dateOf: (row: T) => string,
  from: string,
  to: string
): T[] {
  return rows.filter((row) => {
    const date = dateOf(row)
    return date >= from && date <= to
  })
}
