import { describe, expect, it } from "vitest"

import {
  addDaysToDate,
  formatDateChipLabel,
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

describe("addDaysToDate", () => {
  it("어제/내일을 계산한다", () => {
    expect(addDaysToDate("2026-11-08", -1)).toBe("2026-11-07")
    expect(addDaysToDate("2026-11-08", 1)).toBe("2026-11-09")
  })

  it("월·연 경계와 윤년을 넘는다", () => {
    expect(addDaysToDate("2026-03-01", -1)).toBe("2026-02-28")
    expect(addDaysToDate("2028-03-01", -1)).toBe("2028-02-29")
    expect(addDaysToDate("2026-01-01", -1)).toBe("2025-12-31")
  })
})

describe("formatDateChipLabel", () => {
  it("같은 해면 M/D(요일)", () => {
    expect(formatDateChipLabel("2026-11-05", "2026-11-08")).toBe("11/5(목)")
    expect(formatDateChipLabel("2026-01-01", "2026-11-08")).toBe("1/1(목)")
  })

  it("다른 해면 yy/M/D(요일)", () => {
    expect(formatDateChipLabel("2025-12-31", "2026-01-02")).toBe("25/12/31(수)")
  })
})
