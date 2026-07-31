import { describe, expect, it } from "vitest"

import {
  bizNoSchema,
  formatBizNo,
  isValidBizNoChecksum,
  normalizeBizNo,
} from "./biz-no"

function computeCheckDigit(first9: string): number {
  const d = first9.split("").map(Number)
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5]
  let sum = 0
  for (let i = 0; i < 9; i++) sum += d[i] * weights[i]
  sum += Math.floor((d[8] * 5) / 10)
  return (10 - (sum % 10)) % 10
}

describe("normalizeBizNo", () => {
  it("하이픈과 공백을 제거한다", () => {
    expect(normalizeBizNo("123-45-67890")).toBe("1234567890")
    expect(normalizeBizNo("123 45 67890")).toBe("1234567890")
  })
})

describe("isValidBizNoChecksum", () => {
  it("올바르게 생성한 체크섬은 통과한다", () => {
    for (const prefix of ["123456789", "000000000", "999999998", "555512345"]) {
      const check = computeCheckDigit(prefix)
      expect(isValidBizNoChecksum(`${prefix}${check}`)).toBe(true)
    }
  })

  it("체크 자리가 틀리면 실패한다", () => {
    const prefix = "123456789"
    const check = computeCheckDigit(prefix)
    const wrong = (check + 1) % 10
    expect(isValidBizNoChecksum(`${prefix}${wrong}`)).toBe(false)
  })

  it("10자리가 아니면 실패한다", () => {
    expect(isValidBizNoChecksum("12345")).toBe(false)
    expect(isValidBizNoChecksum("12345678901")).toBe(false)
  })
})

describe("bizNoSchema", () => {
  it("빈 값은 허용한다(선택 필드)", () => {
    expect(bizNoSchema.safeParse("").success).toBe(true)
  })

  it("유효한 사업자번호는 하이픈 유무와 관계없이 통과한다", () => {
    const prefix = "123456789"
    const check = computeCheckDigit(prefix)
    const formatted = `${prefix.slice(0, 3)}-${prefix.slice(3, 5)}-${prefix.slice(5)}${check}`
    expect(bizNoSchema.safeParse(formatted).success).toBe(true)
    expect(bizNoSchema.safeParse(`${prefix}${check}`).success).toBe(true)
  })

  it("체크섬이 틀리면 실패한다", () => {
    expect(bizNoSchema.safeParse("1234567890").success).toBe(false)
  })
})

describe("formatBizNo", () => {
  it("3-2-5 형식으로 표시한다", () => {
    expect(formatBizNo("1234567890")).toBe("123-45-67890")
  })
})
