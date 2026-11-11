import { describe, expect, it } from "vitest"

import {
  filterExpenses,
  summarizeExpenses,
} from "./expense-list"

const row = (category_major: string, category_minor: string, amount: number) => ({
  category_major,
  category_minor,
  amount,
})

const rows = [
  row("차량", "유류", 63764),
  row("차량", "요소수", 23565),
  row("생활", "식비", 12000),
  row("차량", "유류", 54000),
  row("고정지출", "보험료", 90000),
]

describe("summarizeExpenses (상단 요약·대분류 칩)", () => {
  it("전체 건수·합계와 대분류별 건수·합계를 센다", () => {
    const summary = summarizeExpenses(rows)

    expect(summary.count).toBe(5)
    expect(summary.total).toBe(243329)
    expect(summary.byMajor.find((m) => m.major === "차량")).toEqual({
      major: "차량",
      count: 3,
      total: 141329,
    })
    expect(summary.byMajor.find((m) => m.major === "생활")).toEqual({
      major: "생활",
      count: 1,
      total: 12000,
    })
  })

  it("정해진 대분류 순서로, 건수 0인 대분류도 포함한다", () => {
    const summary = summarizeExpenses([row("생활", "식비", 1000)])

    expect(summary.byMajor.map((m) => m.major)).toEqual([
      "차량",
      "생활",
      "고정지출",
      "금융·세금",
    ])
    expect(summary.byMajor.map((m) => m.count)).toEqual([0, 1, 0, 0])
  })

  it("정해진 대분류 밖의 값도 합계에서 빠지지 않고 뒤에 붙는다", () => {
    const summary = summarizeExpenses([
      row("차량", "유류", 1000),
      row("옛분류", "기타", 500),
    ])

    expect(summary.total).toBe(1500)
    expect(summary.byMajor[summary.byMajor.length - 1]).toEqual({
      major: "옛분류",
      count: 1,
      total: 500,
    })
  })

  it("대분류별 합의 합은 전체 합계와 같다", () => {
    const summary = summarizeExpenses(rows)
    expect(summary.byMajor.reduce((sum, m) => sum + m.total, 0)).toBe(
      summary.total
    )
    expect(summary.byMajor.reduce((sum, m) => sum + m.count, 0)).toBe(
      summary.count
    )
  })

  it("행이 없으면 전부 0이다", () => {
    const summary = summarizeExpenses([])
    expect(summary.count).toBe(0)
    expect(summary.total).toBe(0)
  })
})

describe("filterExpenses", () => {
  it("빈 문자열이면 필터를 적용하지 않는다", () => {
    expect(filterExpenses(rows, "", "")).toHaveLength(5)
  })

  it("대분류로 거르고, 소분류까지 주면 둘 다 맞는 행만 남긴다", () => {
    expect(filterExpenses(rows, "차량", "")).toHaveLength(3)
    expect(filterExpenses(rows, "차량", "유류")).toHaveLength(2)
    expect(filterExpenses(rows, "생활", "유류")).toHaveLength(0)
  })
})
