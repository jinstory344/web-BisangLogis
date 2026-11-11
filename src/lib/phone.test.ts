import { describe, expect, it } from "vitest"

import { formatPhoneNumber } from "./phone"

describe("formatPhoneNumber", () => {
  it("하이픈 없이 저장된 휴대폰 번호에 하이픈을 넣는다", () => {
    expect(formatPhoneNumber("01012345678")).toBe("010-1234-5678")
    expect(formatPhoneNumber("010 1234 5678")).toBe("010-1234-5678")
  })

  it("이미 하이픈이 있으면 같은 모양으로 맞춘다", () => {
    expect(formatPhoneNumber("010-1234-5678")).toBe("010-1234-5678")
  })

  it("10자리 지역번호는 3-3-4로 표기한다", () => {
    expect(formatPhoneNumber("0311234567")).toBe("031-123-4567")
    expect(formatPhoneNumber("031-123-4567")).toBe("031-123-4567")
  })

  it("서울(02) 번호는 02-3/4자리-4자리로 표기한다 (3-3-4로 잘못 끊지 않는다)", () => {
    expect(formatPhoneNumber("021234567")).toBe("02-123-4567")
    expect(formatPhoneNumber("0212345678")).toBe("02-1234-5678")
    expect(formatPhoneNumber("02-1234-5678")).toBe("02-1234-5678")
  })

  it("1588 같은 8자리 대표번호는 4-4로 표기한다", () => {
    expect(formatPhoneNumber("15881234")).toBe("1588-1234")
    expect(formatPhoneNumber("1688-1234")).toBe("1688-1234")
  })

  it("비었으면 '-', 알 수 없는 모양은 입력 그대로 둔다", () => {
    expect(formatPhoneNumber(null)).toBe("-")
    expect(formatPhoneNumber(undefined)).toBe("-")
    expect(formatPhoneNumber("")).toBe("-")
    expect(formatPhoneNumber("010-1234")).toBe("010-1234")
    expect(formatPhoneNumber("010-1234-5678 (사무실)")).toBe(
      "010-1234-5678 (사무실)"
    )
    expect(formatPhoneNumber("12345678")).toBe("12345678")
  })
})
