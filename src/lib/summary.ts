/** 전월 대비 문구: "전월 대비 +12%" / "전월 대비 -5%" / "전월과 동일" / "전월 지출 없음" 등 */
export function formatChangeRate(
  current: number,
  previous: number,
  label = "지출"
): string {
  if (previous === 0) {
    return current === 0 ? "전월과 동일" : `전월 ${label} 없음`
  }
  const rate = Math.round(((current - previous) / previous) * 100)
  if (rate === 0) return "전월과 동일"
  return rate > 0 ? `전월 대비 +${rate}%` : `전월 대비 ${rate}%`
}

/** 전체 대비 비율(%) — 전체가 0이면 0 */
export function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}
