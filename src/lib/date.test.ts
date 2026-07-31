import { describe, expect, it } from "vitest"

import {
  getCurrentMonthRangeInSeoul,
  getPreviousMonthRangeInSeoul,
  getTodayInSeoul,
} from "./date"

describe("getTodayInSeoul", () => {
  it("yyyy-MM-dd 형식을 반환한다", () => {
    expect(getTodayInSeoul()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe("getCurrentMonthRangeInSeoul / getPreviousMonthRangeInSeoul", () => {
  it("이번 달 범위는 1일부터 말일까지다", () => {
    const { from, to } = getCurrentMonthRangeInSeoul()
    expect(from.endsWith("-01")).toBe(true)
    expect(from.slice(0, 7)).toBe(to.slice(0, 7))
  })

  it("지난 달의 다음날은 이번 달 1일이다 (연/월 경계 포함)", () => {
    const current = getCurrentMonthRangeInSeoul()
    const previous = getPreviousMonthRangeInSeoul()

    const nextDay = new Date(`${previous.to}T00:00:00Z`)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    const nextDayStr = nextDay.toISOString().slice(0, 10)

    expect(nextDayStr).toBe(current.from)
  })
})
