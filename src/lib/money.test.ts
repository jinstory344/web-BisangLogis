import { describe, expect, it } from "vitest"

import {
  MAX_AMOUNT,
  amountSchema,
  assertVatIntegrity,
  calcNetAmount,
  formatKRW,
  splitVat,
} from "./money"

describe("splitVat", () => {
  it("반올림 기준값들에 대해 정확히 분리한다", () => {
    // 1000 / 1.1 = 909.0909... -> 909
    expect(splitVat(1000, false)).toEqual({ supplyAmount: 909, vatAmount: 91 })
    // 1100 / 1.1 = 1000 (나누어 떨어짐)
    expect(splitVat(1100, false)).toEqual({
      supplyAmount: 1000,
      vatAmount: 100,
    })
    // round-half-up 경계: total*10 % 11 === 5.5 이상이 되는 지점 확인
    // total=11 -> 110/11=10 나머지 0 -> supply=10, vat=1
    expect(splitVat(11, false)).toEqual({ supplyAmount: 10, vatAmount: 1 })
  })

  it("면세 건은 공급가액 = 합계금액, 부가세 = 0", () => {
    expect(splitVat(50000, true)).toEqual({
      supplyAmount: 50000,
      vatAmount: 0,
    })
  })

  it("0원도 정상 처리한다", () => {
    expect(splitVat(0, false)).toEqual({ supplyAmount: 0, vatAmount: 0 })
  })
})

describe("완료 기준: 공급가액 + 부가세 = 합계금액 100% 검증", () => {
  it("0부터 100,000까지 모든 합계금액에 대해 정합성이 성립한다", () => {
    for (let total = 0; total <= 100_000; total++) {
      const { supplyAmount, vatAmount } = splitVat(total, false)
      expect(supplyAmount + vatAmount).toBe(total)
      expect(() =>
        assertVatIntegrity({ totalAmount: total, supplyAmount, vatAmount })
      ).not.toThrow()
    }
  })

  it("무작위 표본 100건에 대해서도 성립한다 (최대 허용 금액 범위)", () => {
    for (let i = 0; i < 100; i++) {
      const total = Math.floor(Math.random() * MAX_AMOUNT)
      const { supplyAmount, vatAmount } = splitVat(total, false)
      expect(supplyAmount + vatAmount).toBe(total)
    }
  })
})

describe("assertVatIntegrity", () => {
  it("불일치 시 저장을 거부하기 위해 예외를 던진다", () => {
    expect(() =>
      assertVatIntegrity({
        totalAmount: 1000,
        supplyAmount: 900,
        vatAmount: 91,
      })
    ).toThrow()
  })
})

describe("calcNetAmount", () => {
  it("공급가액에서 수수료를 뺀다", () => {
    expect(calcNetAmount(909, 50)).toBe(859)
  })
})

describe("formatKRW", () => {
  it("3자리 콤마와 원 단위를 표기한다", () => {
    expect(formatKRW(1234000)).toBe("1,234,000원")
    expect(formatKRW(0)).toBe("0원")
  })
})

describe("amountSchema", () => {
  it("0 이상 정수, 최대값 이하만 허용한다", () => {
    expect(amountSchema.safeParse(0).success).toBe(true)
    expect(amountSchema.safeParse(MAX_AMOUNT).success).toBe(true)
    expect(amountSchema.safeParse(-1).success).toBe(false)
    expect(amountSchema.safeParse(MAX_AMOUNT + 1).success).toBe(false)
    expect(amountSchema.safeParse(1.5).success).toBe(false)
  })
})
