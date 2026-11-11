import { describe, expect, it } from "vitest"

import { DEFAULT_EXPENSE_CATEGORY_TREE, getMajors } from "./constants/expense-categories"
import {
  buildMonthBreakdown,
  filterExpenses,
  summarizeExpenses,
} from "./expense-list"

const MAJORS = getMajors(DEFAULT_EXPENSE_CATEGORY_TREE)

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
    const summary = summarizeExpenses(rows, MAJORS)

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
    const summary = summarizeExpenses([row("생활", "식비", 1000)], MAJORS)

    expect(summary.byMajor.map((m) => m.major)).toEqual([
      "차량",
      "생활",
      "고정지출",
      "금융·세금",
    ])
    expect(summary.byMajor.map((m) => m.count)).toEqual([0, 1, 0, 0])
  })

  it("정해진 대분류 밖의 값도 합계에서 빠지지 않고 뒤에 붙는다", () => {
    const summary = summarizeExpenses(
      [row("차량", "유류", 1000), row("옛분류", "기타", 500)],
      MAJORS
    )

    expect(summary.total).toBe(1500)
    expect(summary.byMajor[summary.byMajor.length - 1]).toEqual({
      major: "옛분류",
      count: 1,
      total: 500,
    })
  })

  it("대분류별 합의 합은 전체 합계와 같다", () => {
    const summary = summarizeExpenses(rows, MAJORS)
    expect(summary.byMajor.reduce((sum, m) => sum + m.total, 0)).toBe(
      summary.total
    )
    expect(summary.byMajor.reduce((sum, m) => sum + m.count, 0)).toBe(
      summary.count
    )
  })

  it("행이 없으면 전부 0이다", () => {
    const summary = summarizeExpenses([], MAJORS)
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

describe("summarizeExpenses: 분류 목록이 바뀌어도 순서를 따른다", () => {
  it("직접 추가한 대분류도 순서대로 0건으로 포함된다", () => {
    const summary = summarizeExpenses([], ["차량", "사무실", "생활"])
    expect(summary.byMajor.map((m) => m.major)).toEqual(["차량", "사무실", "생활"])
  })
})

describe("buildMonthBreakdown (월간 집계 대분류→소분류)", () => {
  const tree = DEFAULT_EXPENSE_CATEGORY_TREE

  it("목록의 모든 대분류를 지출이 없어도 순서대로 보여 주고 소분류는 지출이 있는 것만 목록 순서로", () => {
    const result = buildMonthBreakdown(tree, [
      row("차량", "정비", 30000),
      row("차량", "유류", 50000),
      row("차량", "유류", 10000),
    ])

    expect(result.map((m) => m.major)).toEqual([
      "차량",
      "생활",
      "고정지출",
      "금융·세금",
    ])
    expect(result[0].total).toBe(90000)
    expect(result[0].minors).toEqual([
      { minor: "유류", total: 60000 },
      { minor: "정비", total: 30000 },
    ])
    expect(result[1]).toEqual({ major: "생활", total: 0, minors: [] })
  })

  it("'기타'로 직접 입력한 소분류도 빠지지 않고 금액이 큰 순으로 뒤에 붙는다 (소분류 합 = 대분류 합)", () => {
    const result = buildMonthBreakdown(tree, [
      row("차량", "유류", 1000),
      row("차량", "스로틀바디 교환", 108500),
      row("차량", "에어컨 필터", 20000),
    ])

    expect(result[0].minors.map((m) => m.minor)).toEqual([
      "유류",
      "스로틀바디 교환",
      "에어컨 필터",
    ])
    expect(result[0].total).toBe(129500)
    expect(result[0].minors.reduce((sum, m) => sum + m.total, 0)).toBe(
      result[0].total
    )
  })

  it("목록에 없는 대분류(지운 분류의 옛 지출)도 뒤에 붙고 합계에서 빠지지 않는다", () => {
    const result = buildMonthBreakdown(tree, [
      row("차량", "유류", 1000),
      row("옛분류", "무언가", 500),
    ])

    expect(result[result.length - 1]).toEqual({
      major: "옛분류",
      total: 500,
      minors: [{ minor: "무언가", total: 500 }],
    })
    expect(result.reduce((sum, m) => sum + m.total, 0)).toBe(1500)
  })

  it("직접 추가한 분류 순서를 따른다", () => {
    const custom = [
      { major: "사무실", minors: ["문구", "기타"] },
      { major: "차량", minors: ["유류", "기타"] },
    ]
    const result = buildMonthBreakdown(custom, [
      row("차량", "유류", 1),
      row("사무실", "문구", 2),
    ])
    expect(result.map((m) => m.major)).toEqual(["사무실", "차량"])
  })
})
