import { describe, expect, it } from "vitest"

import {
  applyKeypadKey,
  evaluateKeypad,
  formatKeypadExpr,
  keypadExprFromValue,
  type KeypadKey,
} from "./keypad"
import { MAX_AMOUNT } from "./money"

function press(keys: KeypadKey[], start = ""): string {
  return keys.reduce((expr, key) => applyKeypadKey(expr, key), start)
}

describe("applyKeypadKey", () => {
  it("숫자를 이어 붙이고 000으로 단위를 올린다", () => {
    expect(press(["3", "000", "00"])).toBe("300000")
  })

  it("빈 칸에서 0·00·000은 받지 않는다 (앞자리 0 방지)", () => {
    expect(press(["00"])).toBe("")
    expect(press(["000"])).toBe("")
    expect(press(["0", "5"])).toBe("5")
    expect(press(["0", "00"])).toBe("0")
  })

  it("+로 여러 금액을 더하고, 빈 칸·연속 +는 막는다", () => {
    expect(press(["plus"])).toBe("")
    expect(press(["5", "plus", "plus", "3"])).toBe("5+3")
    expect(press(["5", "plus", "000"])).toBe("5+")
  })

  it("지우기와 전체 지우기", () => {
    expect(press(["1", "2", "back"])).toBe("1")
    expect(press(["1", "plus", "back"])).toBe("1")
    expect(press(["1", "2", "clear"])).toBe("")
    expect(press(["back"])).toBe("")
  })

  it("상한을 넘는 입력은 받지 않는다", () => {
    const max = String(MAX_AMOUNT)
    expect(applyKeypadKey(max, "0")).toBe(max)
    expect(applyKeypadKey(`${max}+`, "1")).toBe(`${max}+`)
    expect(applyKeypadKey("9999999999", "9")).toBe("99999999999")
  })
})

describe("evaluateKeypad", () => {
  it("항들의 합, 비면 null", () => {
    expect(evaluateKeypad("")).toBeNull()
    expect(evaluateKeypad("+")).toBeNull()
    expect(evaluateKeypad("300000+50000")).toBe(350000)
    expect(evaluateKeypad("300000+")).toBe(300000)
  })
})

describe("formatKeypadExpr / keypadExprFromValue", () => {
  it("천 단위 쉼표와 + 띄어쓰기", () => {
    expect(formatKeypadExpr("300000+50000")).toBe("300,000 + 50,000")
    expect(formatKeypadExpr("300000+")).toBe("300,000 +")
    expect(formatKeypadExpr("")).toBe("")
  })

  it("시작 식: 0과 null은 빈 식", () => {
    expect(keypadExprFromValue(0)).toBe("")
    expect(keypadExprFromValue(null)).toBe("")
    expect(keypadExprFromValue(1500)).toBe("1500")
  })
})
