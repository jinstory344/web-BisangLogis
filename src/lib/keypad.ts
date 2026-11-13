import { MAX_AMOUNT } from "./money"

/**
 * 등록 화면 금액 키패드(가계부 앱 방식)의 순수 규칙.
 * 입력은 "300000+50000"처럼 숫자와 "+"만 담은 식 문자열로 들고 있고, 값은 항들의 합이다.
 * 금액은 원 단위 정수, 상한은 MAX_AMOUNT(PRD 4.3) — 넘는 입력은 받지 않는다.
 */

export type KeypadKey =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "00"
  | "000"
  | "back"
  | "clear"
  | "plus"

/** 식의 값 (항들의 합). 숫자가 하나도 없으면 null. */
export function evaluateKeypad(expr: string): number | null {
  const terms = expr.split("+").filter((term) => term !== "")
  if (terms.length === 0) return null
  return terms.reduce((sum, term) => sum + Number(term), 0)
}

/** 키 하나를 눌렀을 때의 새 식. 받을 수 없는 입력(상한 초과 등)이면 이전 식 그대로. */
export function applyKeypadKey(expr: string, key: KeypadKey): string {
  if (key === "clear") return ""
  if (key === "back") return expr.slice(0, -1)

  const lastPlus = expr.lastIndexOf("+")
  const head = expr.slice(0, lastPlus + 1)
  const term = expr.slice(lastPlus + 1)

  if (key === "plus") {
    // 빈 식이나 이미 "+"로 끝난 식에는 붙이지 않는다
    if (term === "") return expr
    return `${expr}+`
  }

  // 숫자: 빈 항에 0·00·000으로 시작하지 않고, "0"뿐인 항은 새 숫자로 바꾼다
  let nextTerm: string
  if (term === "" || term === "0") {
    if (key === "00" || key === "000") return expr
    nextTerm = key
  } else {
    nextTerm = term + key
  }

  const next = head + nextTerm
  const value = evaluateKeypad(next)
  if (value !== null && value > MAX_AMOUNT) return expr
  return next
}

/** 화면 표시용: "300000+50000" → "300,000 + 50,000" */
export function formatKeypadExpr(expr: string): string {
  return expr
    .split("+")
    .map((term) => (term === "" ? "" : Number(term).toLocaleString("ko-KR")))
    .join(" + ")
    .trimEnd()
}

/** 키패드를 열 때의 시작 식: 값이 있으면 그 숫자, 0이나 없음이면 빈 식 */
export function keypadExprFromValue(value: number | null): string {
  return value !== null && value > 0 ? String(value) : ""
}
