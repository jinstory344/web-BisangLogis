/**
 * 전월 대비 문구: "전월 대비 +12%" / "전월 대비 -5%" / "전월과 동일" / "전월 지출 없음" 등.
 * rateWord로 비교 대상을 바꾼다 (연 집계는 "작년 대비 +12%").
 */
export function formatChangeRate(
  current: number,
  previous: number,
  label = "지출",
  rateWord = "전월"
): string {
  if (previous === 0) {
    return current === 0 ? `${rateWord}과 동일` : `${rateWord} ${label} 없음`
  }
  const rate = Math.round(((current - previous) / previous) * 100)
  if (rate === 0) return `${rateWord}과 동일`
  return rate > 0 ? `${rateWord} 대비 +${rate}%` : `${rateWord} 대비 ${rate}%`
}

/** 전체 대비 비율(%) — 전체가 0이면 0 */
export function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

/** 집계 카드의 비교 기간 (달 집계 = 지난 달, 해 집계 = 작년, 전체 = 없음) */
export interface SummaryComparison {
  /** "지난 달" / "작년" */
  label: string
  /** 대비 문구 앞말: "전월" / "작년" */
  rateWord: string
  total: number
}

/** 집계 카드 맨 위 제목 글자 (통계·보기 공통: 조금 크게, 흰색) */
export const SUMMARY_TITLE_CLASS = "text-base text-foreground"
