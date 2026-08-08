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

/** 3자리 콤마 + "원" 표기 (4.4 UI 표시 규칙) */
export function formatKRW(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`
}
