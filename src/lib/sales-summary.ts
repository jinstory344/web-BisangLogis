import { SOURCE_MAJOR_OPTIONS } from "@/lib/constants/source"
import type { PaymentStatus } from "@/lib/supabase/database.types"

/** 출처 대분류가 비어 있는 매출을 묶는 이름 */
export const UNSET_SOURCE_LABEL = "미지정"
/** 소분류가 비어 있는 매출을 묶는 이름 */
export const UNSET_MINOR_LABEL = "이름 없음"

export interface SourceMinorTotals {
  minor: string
  count: number
  supplyAmount: number
}

export interface SourceMajorTotals {
  major: string
  count: number
  supplyAmount: number
  /** 공급가액이 큰 순 (같으면 이름순) */
  minors: SourceMinorTotals[]
}

export interface SalesMonthSummary {
  count: number
  supplyAmount: number
  totalAmount: number
  paidSupplyAmount: number
  unpaidSupplyAmount: number
  /** 출처 대분류별 (정해진 순서 → 그 밖의 값 → 미지정). 건수 0인 대분류는 뺀다. */
  byMajor: SourceMajorTotals[]
}

interface SummarizableSale {
  source_major: string | null
  source_minor: string | null
  supply_amount: number
  total_amount: number
  payment_status: PaymentStatus
}

/** 한 달 매출을 출처 대분류 → 소분류로 묶어 공급가액 합계를 구한다 (월간 집계 탭). */
export function summarizeSalesMonth(
  sales: readonly SummarizableSale[]
): SalesMonthSummary {
  const majors = new Map<
    string,
    { count: number; supplyAmount: number; minors: Map<string, SourceMinorTotals> }
  >()
  let count = 0
  let supplyAmount = 0
  let totalAmount = 0
  let paidSupplyAmount = 0
  let unpaidSupplyAmount = 0

  for (const sale of sales) {
    count += 1
    supplyAmount += sale.supply_amount
    totalAmount += sale.total_amount
    if (sale.payment_status === "PAID") paidSupplyAmount += sale.supply_amount
    else unpaidSupplyAmount += sale.supply_amount

    const majorName = sale.source_major?.trim() || UNSET_SOURCE_LABEL
    let major = majors.get(majorName)
    if (!major) {
      major = { count: 0, supplyAmount: 0, minors: new Map() }
      majors.set(majorName, major)
    }
    major.count += 1
    major.supplyAmount += sale.supply_amount

    const minorName = sale.source_minor?.trim() || UNSET_MINOR_LABEL
    let minor = major.minors.get(minorName)
    if (!minor) {
      minor = { minor: minorName, count: 0, supplyAmount: 0 }
      major.minors.set(minorName, minor)
    }
    minor.count += 1
    minor.supplyAmount += sale.supply_amount
  }

  const knownOrder = new Map<string, number>(
    SOURCE_MAJOR_OPTIONS.map((name, index) => [name, index])
  )
  const rank = (name: string) =>
    name === UNSET_SOURCE_LABEL
      ? Number.MAX_SAFE_INTEGER
      : (knownOrder.get(name) ?? SOURCE_MAJOR_OPTIONS.length)

  const byMajor = [...majors.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([major, value]) => ({
      major,
      count: value.count,
      supplyAmount: value.supplyAmount,
      minors: [...value.minors.values()].sort(
        (a, b) =>
          b.supplyAmount - a.supplyAmount || a.minor.localeCompare(b.minor, "ko")
      ),
    }))

  return {
    count,
    supplyAmount,
    totalAmount,
    paidSupplyAmount,
    unpaidSupplyAmount,
    byMajor,
  }
}
