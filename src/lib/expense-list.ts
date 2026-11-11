import { EXPENSE_CATEGORY_MAJORS } from "@/lib/constants/expense-categories"

export interface MajorTotals {
  major: string
  count: number
  total: number
}

export interface ExpenseSummary {
  count: number
  total: number
  /** 정해진 대분류(차량·생활·고정지출·금융·세금) 순서, 그 밖의 값은 처음 나온 순서로 뒤에. 건수 0인 대분류도 포함한다. */
  byMajor: MajorTotals[]
}

interface SummarizableExpense {
  category_major: string
  amount: number
}

/** 지출 행들의 전체 건수·합계와 대분류별 건수·합계 */
export function summarizeExpenses(
  rows: readonly SummarizableExpense[]
): ExpenseSummary {
  const byMajor = new Map<string, MajorTotals>(
    EXPENSE_CATEGORY_MAJORS.map((major) => [major, { major, count: 0, total: 0 }])
  )
  let count = 0
  let total = 0

  for (const row of rows) {
    let entry = byMajor.get(row.category_major)
    if (!entry) {
      entry = { major: row.category_major, count: 0, total: 0 }
      byMajor.set(row.category_major, entry)
    }
    entry.count += 1
    entry.total += row.amount
    count += 1
    total += row.amount
  }

  return { count, total, byMajor: [...byMajor.values()] }
}

/** 대분류·소분류 필터에 맞는 행만 남긴다 (빈 문자열이면 그 필터는 적용하지 않는다). */
export function filterExpenses<
  T extends { category_major: string; category_minor: string },
>(rows: readonly T[], major: string, minor: string): T[] {
  return rows.filter(
    (row) =>
      (!major || row.category_major === major) &&
      (!minor || row.category_minor === minor)
  )
}
