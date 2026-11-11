import { groupByDay } from "@/lib/day-groups"
import type { PaymentStatus } from "@/lib/supabase/database.types"

/** 날짜 하나에 속한 매출 행들 (모바일 매출 목록의 "날짜별 묶음") */
export interface DayGroup<T> {
  /** yyyy-MM-dd */
  date: string
  rows: T[]
  /** 그날 공급가액 합계 */
  supplyAmount: number
}

/**
 * 매출 행을 매출일자별로 묶는다. 묶음 순서와 묶음 안의 순서는 입력 순서를 그대로 따른다
 * (조회가 sale_date 내림차순이면 최근 날짜가 먼저).
 */
export function groupSalesByDay<
  T extends { sale_date: string; supply_amount: number },
>(sales: readonly T[]): DayGroup<T>[] {
  return groupByDay(
    sales,
    (sale) => sale.sale_date,
    (sale) => sale.supply_amount
  ).map((group) => ({
    date: group.date,
    rows: group.rows,
    supplyAmount: group.total,
  }))
}

export interface StatusTotals {
  count: number
  supplyAmount: number
  /** 세액 포함 합계금액 */
  totalAmount: number
}

export interface StatusSummary {
  all: StatusTotals
  unpaid: StatusTotals
  paid: StatusTotals
}

interface SummarizableSale {
  payment_status: PaymentStatus
  supply_amount: number
  total_amount: number
}

function emptyTotals(): StatusTotals {
  return { count: 0, supplyAmount: 0, totalAmount: 0 }
}

function addTo(totals: StatusTotals, sale: SummarizableSale) {
  totals.count += 1
  totals.supplyAmount += sale.supply_amount
  totals.totalAmount += sale.total_amount
}

/** 매출 목록 상단 요약: 전체 / 미입금 / 입금완료의 건수·공급가액·합계금액 */
export function summarizeByPaymentStatus(
  sales: readonly SummarizableSale[]
): StatusSummary {
  const summary: StatusSummary = {
    all: emptyTotals(),
    unpaid: emptyTotals(),
    paid: emptyTotals(),
  }

  for (const sale of sales) {
    addTo(summary.all, sale)
    addTo(sale.payment_status === "PAID" ? summary.paid : summary.unpaid, sale)
  }

  return summary
}

/** 입금여부 필터("" | "UNPAID" | "PAID")에 해당하는 합계 */
export function pickStatusTotals(
  summary: StatusSummary,
  paymentStatus: string
): StatusTotals {
  if (paymentStatus === "UNPAID") return summary.unpaid
  if (paymentStatus === "PAID") return summary.paid
  return summary.all
}
