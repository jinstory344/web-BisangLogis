import { describe, expect, it } from "vitest"

import { formatLiters, isFuelCategory, parseLiters, summarizeLiters } from "./fuel"

describe("fuel", () => {
  it("리터 칸이 나오는 분류", () => {
    expect(isFuelCategory("차량", "주유비")).toBe(true)
    expect(isFuelCategory("차량", "요소수")).toBe(true)
    expect(isFuelCategory("차량", "정비")).toBe(false)
    expect(isFuelCategory("생활", "주유비")).toBe(false)
  })

  it("리터 입력 읽기", () => {
    expect(parseLiters("")).toBeNull()
    expect(parseLiters(" 120 ")).toBe(120)
    expect(parseLiters("85.5")).toBe(85.5)
    expect(parseLiters("1,200")).toBe(1200)
    expect(parseLiters("0")).toBeNaN()
    expect(parseLiters("1.25")).toBeNaN()
    expect(parseLiters("abc")).toBeNaN()
    expect(parseLiters("100000")).toBeNaN()
  })

  it("리터 표시", () => {
    expect(formatLiters(1234.5)).toBe("1,234.5L")
    expect(formatLiters(80)).toBe("80L")
  })

  it("이번 달 합과 기록 있는 달의 월 평균", () => {
    const rows = [
      { expense_date: "2026-11-02", category_minor: "주유비", liters: 100 },
      { expense_date: "2026-11-20", category_minor: "주유비", liters: 50.5 },
      { expense_date: "2026-10-05", category_minor: "주유비", liters: 200 },
      { expense_date: "2026-09-05", category_minor: "주유비", liters: null },
      { expense_date: "2026-11-03", category_minor: "요소수", liters: 10 },
    ]
    const [fuel, urea] = summarizeLiters(rows, "2026-11-01")
    expect(fuel).toEqual({ minor: "주유비", month: 150.5, monthCount: 2, average: 175.3, averageMonths: 2 })
    expect(urea).toMatchObject({ minor: "요소수", month: 10, average: 10, averageMonths: 1 })
    expect(summarizeLiters([], "2026-11-01")[0]).toMatchObject({ month: 0, average: null })
  })
})
