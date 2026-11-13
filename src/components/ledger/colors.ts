/** 장부에서 매출(들어온 돈)은 파랑, 지출(나간 돈)은 빨강으로 보여 준다 (가계부 앱과 같은 규칙). */
export const INCOME_TEXT_CLASS = "text-blue-600 dark:text-blue-400"
export const EXPENSE_TEXT_CLASS = "text-red-600 dark:text-red-400"

/** 차액(매출 − 지출): 0 이상이면 파랑, 음수면 빨강 */
export function netTextClass(net: number): string {
  return net < 0 ? EXPENSE_TEXT_CLASS : INCOME_TEXT_CLASS
}

/** HOME·검색 요약의 수익: 흑자는 흰색(라이트 모드는 검정) 굵게, 적자는 빨강 굵게 */
export function profitTextClass(net: number): string {
  return net < 0 ? `${EXPENSE_TEXT_CLASS} font-bold` : "text-foreground font-bold"
}
