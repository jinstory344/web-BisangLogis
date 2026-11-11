import type { ExpenseCategoryTree } from "@/lib/constants/expense-categories"

export interface MajorTotals {
  major: string
  count: number
  total: number
}

export interface ExpenseSummary {
  count: number
  total: number
  /** 분류 목록의 대분류 순서, 목록에 없는 값(지운 분류의 옛 지출 등)은 처음 나온 순서로 뒤에. 건수 0인 대분류도 포함한다. */
  byMajor: MajorTotals[]
}

interface SummarizableExpense {
  category_major: string
  amount: number
}

/**
 * 지출 행들의 전체 건수·합계와 대분류별 건수·합계.
 * majorOrder는 화면에 보여 줄 대분류 순서(분류 목록의 대분류들)이고, 건수 0인 대분류도 포함한다.
 */
export function summarizeExpenses(
  rows: readonly SummarizableExpense[],
  majorOrder: readonly string[]
): ExpenseSummary {
  const byMajor = new Map<string, MajorTotals>(
    majorOrder.map((major) => [major, { major, count: 0, total: 0 }])
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

export interface MinorBreakdown {
  minor: string
  total: number
}

export interface MajorBreakdown {
  major: string
  total: number
  /** 지출이 있는 소분류만 */
  minors: MinorBreakdown[]
}

interface BreakdownExpense {
  category_major: string
  category_minor: string
  amount: number
}

/**
 * 월간 집계 탭용 대분류 → 소분류 합계.
 * 대분류는 분류 목록 순서(지출이 없어도 포함) 뒤에 목록에 없는 대분류가 처음 나온 순서로 붙고,
 * 소분류는 목록 순서로 지출이 있는 것만 보여 준 뒤 목록에 없는 소분류(직접 입력한 값, 지운 분류)를
 * 금액이 큰 순으로 붙인다. 그래서 소분류 합은 항상 대분류 합과 같다.
 */
export function buildMonthBreakdown(
  tree: ExpenseCategoryTree,
  rows: readonly BreakdownExpense[]
): MajorBreakdown[] {
  const majors = new Map<string, Map<string, number>>(
    tree.map((node) => [node.major, new Map<string, number>()])
  )

  for (const row of rows) {
    let minors = majors.get(row.category_major)
    if (!minors) {
      minors = new Map()
      majors.set(row.category_major, minors)
    }
    minors.set(row.category_minor, (minors.get(row.category_minor) ?? 0) + row.amount)
  }

  return [...majors.entries()].map(([major, minors]) => {
    const listed = tree.find((node) => node.major === major)?.minors ?? []
    const ordered: MinorBreakdown[] = []

    for (const minor of listed) {
      const total = minors.get(minor)
      if (total !== undefined) ordered.push({ minor, total })
    }

    const extra = [...minors.entries()]
      .filter(([minor]) => !listed.includes(minor))
      .map(([minor, total]) => ({ minor, total }))
      .sort(
        (a, b) => b.total - a.total || a.minor.localeCompare(b.minor, "ko")
      )

    const minorList = [...ordered, ...extra]
    return {
      major,
      total: minorList.reduce((sum, m) => sum + m.total, 0),
      minors: minorList,
    }
  })
}
