/** 날짜 하나에 속한 행들 (모바일 목록의 "날짜별 묶음") */
export interface DayGroup<T> {
  /** yyyy-MM-dd */
  date: string
  rows: T[]
  /** 그날 금액 합계 */
  total: number
}

/**
 * 행을 날짜별로 묶는다. 묶음 순서와 묶음 안의 순서는 입력 순서를 그대로 따른다
 * (조회가 날짜 내림차순이면 최근 날짜가 먼저).
 */
export function groupByDay<T>(
  rows: readonly T[],
  getDate: (row: T) => string,
  getAmount: (row: T) => number
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = []
  const indexByDate = new Map<string, number>()

  for (const row of rows) {
    const date = getDate(row)
    let index = indexByDate.get(date)
    if (index === undefined) {
      index = groups.length
      indexByDate.set(date, index)
      groups.push({ date, rows: [], total: 0 })
    }

    const group = groups[index]
    group.rows.push(row)
    group.total += getAmount(row)
  }

  return groups
}

/** 묶음들이 서로 다른 달에 걸쳐 있는지 (걸치면 날짜 머리글에 월을 함께 보여 준다) */
export function spansMultipleMonths(groups: readonly { date: string }[]): boolean {
  if (groups.length === 0) return false
  const months = new Set(groups.map((group) => group.date.slice(0, 7)))
  return months.size > 1
}
