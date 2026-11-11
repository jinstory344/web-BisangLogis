import { z } from "zod"

/**
 * 4.3 금액·정확성 규칙 구현.
 * 모든 금액은 원 단위 정수(bigint 컬럼에 대응하는 number)로만 다룬다.
 * 부가세 분리는 부동소수점 나눗셈 대신 정수 연산으로 계산해
 * 반올림 오차 없이 정확히 round-half-up 결과를 얻는다.
 */

export const MAX_AMOUNT = 99_999_999_999

export const amountSchema = z
  .number()
  .int("금액은 정수여야 합니다")
  .min(0, "금액은 0 이상이어야 합니다")
  .max(MAX_AMOUNT, "금액이 최대 허용치를 초과했습니다")

export interface VatSplit {
  supplyAmount: number
  vatAmount: number
}

/**
 * supply_amount = round(total_amount / 1.1) (round-half-up)
 * total*10/11 을 BigInt 정수 나눗셈으로 계산해 부동소수점 오차를 원천 차단한다.
 */
export function calcSupplyAmount(totalAmount: number): number {
  const total = BigInt(totalAmount)
  const numerator = total * 10n
  const quotient = numerator / 11n
  const remainder = numerator % 11n
  const roundedUp = remainder * 2n >= 11n ? quotient + 1n : quotient
  return Number(roundedUp)
}

/** 합계금액(부가세 포함)을 공급가액·부가세로 분리한다. */
export function splitVat(
  totalAmount: number,
  isVatExempt: boolean
): VatSplit {
  if (isVatExempt) {
    return { supplyAmount: totalAmount, vatAmount: 0 }
  }

  const supplyAmount = calcSupplyAmount(totalAmount)
  const vatAmount = totalAmount - supplyAmount
  return { supplyAmount, vatAmount }
}

/**
 * 저장 직전 반드시 호출해야 하는 정합성 검증.
 * `supply_amount + vat_amount === total_amount` 불일치 시 저장을 거부한다(4.3.2).
 */
export function assertVatIntegrity(input: {
  totalAmount: number
  supplyAmount: number
  vatAmount: number
}): void {
  if (input.supplyAmount + input.vatAmount !== input.totalAmount) {
    throw new Error(
      `부가세 정합성 오류: 공급가액(${input.supplyAmount}) + 부가세(${input.vatAmount}) ` +
        `!== 합계금액(${input.totalAmount})`
    )
  }
}

/** 순수익 = 공급가액 - 수수료 (4.3.4, 공급가액 기준) */
export function calcNetAmount(supplyAmount: number, feeAmount: number): number {
  return supplyAmount - feeAmount
}

export interface VatFromSupply {
  vatAmount: number
  totalAmount: number
}

/**
 * 공급가액을 진실의 원천으로 받아 부가세·합계금액을 역산한다 (배차 등록 폼).
 * vat_amount = round(supply_amount / 10) (round-half-up)을 정수 연산으로 계산해
 * 부동소수점 오차 없이 구한다.
 */
export function calcVatFromSupply(
  supplyAmount: number,
  isVatExempt: boolean
): VatFromSupply {
  if (isVatExempt) {
    return { vatAmount: 0, totalAmount: supplyAmount }
  }

  const vatAmount = Math.floor((supplyAmount + 5) / 10)
  return { vatAmount, totalAmount: supplyAmount + vatAmount }
}

/**
 * 매출의 세액 규칙: 세액은 지불방법이 "세금계산서"일 때만 붙는다.
 * 계좌이체·현금은 현금 거래로 보아 세액이 없다 (create_sale/update_sale RPC의
 * p_is_vat_exempt = true와 같은 효과). 사용자가 직접 정한 업무 규칙이므로
 * 폼·서버 액션·복사 등록이 모두 이 함수 하나만 쓴다 — 별도의 "현금" 체크박스는 없다.
 * 입력이 알 수 없는 값이면 세금계산서가 아닌 것으로 보고 true를 돌려주지만,
 * 그런 값은 어차피 payment_method 검증(zod enum)에서 거부된다.
 */
export function isVatExemptForPayment(paymentMethod: string): boolean {
  return paymentMethod !== "TAX_INVOICE"
}

/** 3자리 콤마 + "원" 표기 (4.4 UI 표시 규칙) */
export function formatKRW(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`
}

/**
 * 금액 입력칸(components/form/amount-input.tsx) 전용 헬퍼.
 * 입력 중에도 천 단위 쉼표를 보여주고, 저장값은 항상 원 단위 정수(또는 null)로 유지한다.
 *
 * 입력 규칙 — 금액은 원 단위 정수라서 입력칸에는 숫자와 쉼표만 보이고 소수점은 나타나지 않는다:
 * - 직접 타이핑하는 한 글자는 숫자만 받는다. ".", "-", 괄호, 글자 등은 무시한다(값·화면 불변).
 *   점이 화면에 남지 않으므로, 점을 지우거나 숫자 사이에 끼워 넣다가 금액이 10배·100배로
 *   둔갑하는 경로 자체가 없다.
 * - 붙여넣기·드롭처럼 한꺼번에 들어온 조각만 따로 정규화한다(normalizeAmountFragment):
 *   공백·"원"은 지우고, 소수부가 비었거나 전부 0이면 정수부만 쓴다("550,000.00" → 550000).
 *   0이 아닌 소수부, 소수점 두 개 이상, 음수 표시(-, −, －, 회계식 괄호), 천 단위가 아닌 쉼표
 *   ("1,5", "0,500"), 숫자 외 문자가 섞이거나 숫자가 하나도 없는 조각(공백·"원"·".00"만)이면
 *   편집 전체를 거부한다 — 조용히 숫자만 이어 붙이거나 선택한 숫자를 지우면 금액이 바뀌기
 *   때문이다.
 * - 상한(MAX_AMOUNT, PRD 4.3) 초과도 거부한다.
 */

/** 숫자 문자열에 천 단위 쉼표를 넣는다 (로케일과 무관하게 서버/클라이언트 결과가 같도록 정규식 사용). */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

/** 음수 표시: 하이픈-마이너스, 유니코드 마이너스(U+2212), 전각 하이픈(U+FF0D), 회계식 괄호 */
const NEGATIVE_MARKER_PATTERN = /[-−－()]/

/**
 * 정수부: 쉼표가 있으면 반드시 천 단위("1,234,567")이고 첫 그룹은 0으로 시작하지 않는다
 * ("0,500"은 소수 쉼표로도 읽혀 모호하므로 거부). 쉼표가 없으면 숫자 아무 길이.
 * 소수부는 전부 0만 허용.
 */
const AMOUNT_FRAGMENT_PATTERN = /^([1-9]\d{0,2}(?:,\d{3})+|\d*)(?:\.0*)?$/

/**
 * 붙여넣은 조각을 정수 숫자열로 정규화한다.
 * - 숫자가 하나도 없으면 빈 문자열("").
 * - 거부해야 하면 null: 0이 아닌 소수부, 소수점 2개 이상, 음수 표시, 천 단위가 아닌 쉼표,
 *   숫자·쉼표·"."·공백·"원" 외 문자. (전각 마침표 "．"는 "."으로 본다.)
 */
export function normalizeAmountFragment(fragment: string): string | null {
  const text = fragment.replace(/．/g, ".").replace(/[\s원]/g, "")
  if (NEGATIVE_MARKER_PATTERN.test(text)) return null

  const match = AMOUNT_FRAGMENT_PATTERN.exec(text)
  return match ? match[1].replace(/,/g, "") : null
}

/** 정수부 숫자열 → 값. 상한 초과는 "overflow". 빈 숫자열은 호출 쪽에서 처리한다. */
function parseIntegerDigits(digits: string): number | "overflow" {
  const withoutLeadingZeros = digits.replace(/^0+(?=\d)/, "")
  // 자릿수가 상한보다 많으면 Number 변환 정밀도와 무관하게 초과로 판정한다.
  if (withoutLeadingZeros.length > String(MAX_AMOUNT).length) return "overflow"

  const value = Number(withoutLeadingZeros)
  return value > MAX_AMOUNT ? "overflow" : value
}

/**
 * 금액 문자열(붙여넣은 텍스트 등)을 원 단위 정수로 해석한다 (규칙은 위 블록 주석 참고).
 * - 숫자가 하나도 없으면 null(빈칸). 0을 쓸지 null을 쓸지는 호출하는 쪽(입력 모드)이 정한다.
 * - "invalid": normalizeAmountFragment가 거부하는 입력, "overflow": 상한 초과.
 */
export function parseAmountInput(
  text: string
): number | null | "overflow" | "invalid" {
  const digits = normalizeAmountFragment(text)
  if (digits === null) return "invalid"
  if (digits === "") return null

  return parseIntegerDigits(digits)
}

/**
 * 금액 값을 입력칸 표시 문자열로 바꾼다 (천 단위 쉼표, "원"은 입력칸 밖에 표시).
 * `emptyWhenZero`: 0 기본값 필드(공급가액·수수료·지출 금액)는 0을 빈칸으로 보여줘야
 * 앞자리에 0이 남는 입력 버그가 생기지 않는다.
 */
export function formatAmountInput(
  value: number | null | undefined,
  options: { emptyWhenZero?: boolean } = {}
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ""
  if (value === 0 && options.emptyWhenZero) return ""
  return groupThousands(String(Math.trunc(value)))
}

/**
 * 쉼표를 다시 넣은 뒤에도 커서가 "같은 숫자 뒤"에 머물도록, 앞쪽 숫자 개수(digitCount)에
 * 해당하는 표시 문자열의 커서 위치를 구한다. 숫자가 모자라면 맨 끝을 돌려준다.
 */
function caretIndexAfterDigits(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0

  let seen = 0
  for (let index = 0; index < formatted.length; index++) {
    if (formatted[index] >= "0" && formatted[index] <= "9") {
      seen++
      if (seen === digitCount) return index + 1
    }
  }
  return formatted.length
}

function digitsOf(text: string): string {
  return text.replace(/\D/g, "")
}

function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length)
  let index = 0
  while (index < max && a[index] === b[index]) index++
  return index
}

function commonSuffixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length)
  let index = 0
  while (index < max && a[a.length - 1 - index] === b[b.length - 1 - index]) index++
  return index
}

/** 편집 전 입력칸에서 교체된 구간 [start, end) — 브라우저의 beforeinput 시점 선택 범위. */
export type AmountEditRange = { start: number; end: number }

/**
 * 한 번의 편집을 "편집 전 문자열의 앞부분(prefix) + 바뀐 부분 + 뒷부분(suffix)"으로 나눈다.
 *
 * - replacedRange가 있고 편집 전후 문자열과 맞아떨어지면 그대로 쓴다. 앞뒤 글자를 비교해
 *   추측하면, 선택 영역을 덮어쓸 때 새 글자가 선택 영역의 첫 글자와 같으면 그 글자가 "안
 *   바뀐 앞부분"으로 잘못 계산되기 때문이다 (예: 선택한 "1," 위에 "1,5"를 붙여넣기).
 * - 없으면(삭제, 조합 입력 등) 편집 후 커서 뒤 문자열이 편집 전 문자열의 끝과 같을 때 그 길이를
 *   접미로 삼고, 아니면 공통 접미를 쓴다. 삭제는 결과 문자열이 같아 추측이 달라도 안전하다.
 */
function locateEdit(
  previous: string,
  next: string,
  caret: number,
  replacedRange?: AmountEditRange
) {
  if (replacedRange) {
    const { start, end } = replacedRange
    const suffixLength = previous.length - end
    const insertedEnd = next.length - suffixLength
    const consistent =
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 0 &&
      start <= end &&
      end <= previous.length &&
      insertedEnd >= start &&
      next.slice(0, start) === previous.slice(0, start) &&
      next.slice(insertedEnd) === previous.slice(end)

    if (consistent) {
      return {
        prefixLength: start,
        suffixLength,
        removed: previous.slice(start, end),
        inserted: next.slice(start, insertedEnd),
      }
    }
  }

  const caretIndex = Math.min(Math.max(caret, 0), next.length)
  const tail = next.slice(caretIndex)
  const suffixLength = Math.min(
    previous.endsWith(tail) ? tail.length : commonSuffixLength(previous, next),
    previous.length,
    next.length
  )
  const prefixLength = Math.min(
    commonPrefixLength(previous, next),
    previous.length - suffixLength,
    next.length - suffixLength
  )

  return {
    prefixLength,
    suffixLength,
    removed: previous.slice(prefixLength, previous.length - suffixLength),
    inserted: next.slice(prefixLength, next.length - suffixLength),
  }
}

export type AmountInputEditResult =
  /** 거부: 상한 초과 / 숫자가 아닌 한 글자 / 정규화할 수 없는 붙여넣기. 입력칸은 이전 표시를 유지한다. */
  | { status: "overflow" }
  | { status: "invalid" }
  | {
      status: "ok"
      value: number | null
      /** formatAmountInput(value) 표시 문자열 기준 커서 위치 */
      caret: number
    }

/**
 * 금액 입력칸의 한 번의 편집(onChange)을 해석한다 (입력 규칙은 위 블록 주석 참고).
 *
 * - 바뀐 부분이 한 글자면 숫자만 받고, 두 글자 이상(붙여넣기 등)이면 조각을 정규화한다.
 * - 빈칸은 value=null (0 기본값 필드는 호출 쪽에서 0으로 바꾼다).
 * - 쉼표 위에서 Backspace/Delete를 누르면 브라우저는 쉼표 한 글자만 지워 아무 일도 안
 *   일어난 것처럼 보이므로, 쉼표 바로 앞(Backspace)/뒤(Delete)의 숫자를 대신 지운다.
 * - caret: 쉼표를 다시 넣은 표시 문자열 기준으로, 사용자가 편집한 숫자 바로 뒤의 커서 위치.
 *
 * @param previousText  편집 전 입력칸에 보이던 문자열 (항상 숫자와 쉼표뿐)
 * @param nextText      편집 후 입력칸 문자열
 * @param caret         편집 후 커서 위치(nextText 기준)
 * @param inputType     InputEvent.inputType ("insertText", "deleteContentBackward" 등)
 * @param replacedRange 입력(타이핑·붙여넣기) 직전 선택 범위. 있으면 바뀐 구간을 추측하지 않고 쓴다
 * @param emptyWhenZero 0을 빈칸으로 보여주는 필드인지 (formatAmountInput과 동일)
 */
export function applyAmountInputEdit(input: {
  previousText: string
  nextText: string
  caret: number
  inputType?: string
  replacedRange?: AmountEditRange
  emptyWhenZero?: boolean
}): AmountInputEditResult {
  const { prefixLength, suffixLength, removed, inserted } = locateEdit(
    input.previousText,
    input.nextText,
    input.caret,
    input.replacedRange
  )

  let fragmentDigits = ""
  if (inserted.length === 1) {
    if (!/[0-9]/.test(inserted)) return { status: "invalid" }
    fragmentDigits = inserted
  } else if (inserted.length > 1) {
    const normalized = normalizeAmountFragment(inserted)
    // 숫자가 하나도 없는 조각(공백·"원"·".00" 등)이 선택한 숫자를 지우지 않도록 거부한다.
    if (normalized === null || normalized === "") return { status: "invalid" }
    fragmentDigits = normalized
  }

  const prefixDigits = digitsOf(input.nextText.slice(0, prefixLength))
  const suffixDigits = digitsOf(
    input.nextText.slice(input.nextText.length - suffixLength)
  )
  let digits = prefixDigits + fragmentDigits + suffixDigits
  let digitsBeforeCaret = prefixDigits.length + fragmentDigits.length

  // 쉼표 한 글자만 지워진 경우: 쉼표 대신 인접한 숫자를 지운다.
  if (removed === "," && inserted === "") {
    if (input.inputType === "deleteContentBackward" && digitsBeforeCaret > 0) {
      digits =
        digits.slice(0, digitsBeforeCaret - 1) + digits.slice(digitsBeforeCaret)
      digitsBeforeCaret -= 1
    } else if (
      input.inputType === "deleteContentForward" &&
      digitsBeforeCaret < digits.length
    ) {
      digits =
        digits.slice(0, digitsBeforeCaret) + digits.slice(digitsBeforeCaret + 1)
    }
  }

  let value: number | null
  if (digits === "") {
    value = null
  } else {
    const parsed = parseIntegerDigits(digits)
    if (parsed === "overflow") return { status: "overflow" }
    value = parsed
  }

  const display = formatAmountInput(value, {
    emptyWhenZero: input.emptyWhenZero,
  })

  // parseIntegerDigits가 떼어낸 앞자리 0만큼 커서 앞 숫자 개수도 줄인다 ("05" -> "5").
  const strippedZeros = digits.length - digits.replace(/^0+(?=\d)/, "").length
  const caretDigits = Math.max(
    0,
    digitsBeforeCaret - Math.min(strippedZeros, digitsBeforeCaret)
  )

  return {
    status: "ok",
    value,
    caret: caretIndexAfterDigits(display, caretDigits),
  }
}
