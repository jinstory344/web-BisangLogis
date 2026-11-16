/** 리터 칸이 나오는 지출 분류 (차량 › 주유비 · 요소수) */
export const FUEL_MAJOR = "차량"
export const FUEL_MINORS = ["주유비", "요소수"] as const

export function isFuelCategory(major: string, minor: string): boolean {
  return major === FUEL_MAJOR && (FUEL_MINORS as readonly string[]).includes(minor)
}

/** 리터 입력 글자 → 숫자. 빈칸은 null, 잘못된 값은 NaN (소수 첫째 자리까지, 0 초과 10만 미만) */
export function parseLiters(raw: string): number | null {
  const text = raw.trim().replace(/,/g, "")
  if (text === "") return null
  if (!/^\d{1,5}(\.\d)?$/.test(text)) return Number.NaN
  const value = Number(text)
  return value > 0 && value < 100000 ? value : Number.NaN
}

/** 120 → "120L", 85.5 → "85.5L", 1234 → "1,234L" */
export function formatLiters(value: number): string {
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}L`
}

export interface LiterRow {
  expense_date: string
  category_minor: string
  liters: number | null
}

export interface LiterSummary {
  minor: string
  /** 이번 달 리터 합 */
  month: number
  /** 이번 달 리터를 적은 건수 */
  monthCount: number
  /** 리터를 적은 달들의 월 평균 (기록이 없으면 null) */
  average: number | null
  /** 평균에 들어간 달 수 */
  averageMonths: number
}

/**
 * 주유비·요소수별 이번 달 리터와 월 평균. rows는 최근 몇 달(이번 달 포함) 줄들.
 * 월 평균은 리터를 하나라도 적은 달만 센다 — 적기 시작하기 전 달이 0으로 섞여 평균이 낮아지지 않게.
 */
export function summarizeLiters(rows: readonly LiterRow[], monthFrom: string): LiterSummary[] {
  const thisMonth = monthFrom.slice(0, 7)
  return FUEL_MINORS.map((minor) => {
    const byMonth = new Map<string, number>()
    let month = 0
    let monthCount = 0
    for (const row of rows) {
      if (row.category_minor !== minor || row.liters === null) continue
      const key = row.expense_date.slice(0, 7)
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(row.liters))
      if (key === thisMonth) {
        month += Number(row.liters)
        monthCount += 1
      }
    }
    const totals = [...byMonth.values()]
    const sum = totals.reduce((a, b) => a + b, 0)
    return {
      minor,
      month: Math.round(month * 10) / 10,
      monthCount,
      average: totals.length > 0 ? Math.round((sum / totals.length) * 10) / 10 : null,
      averageMonths: totals.length,
    }
  })
}
