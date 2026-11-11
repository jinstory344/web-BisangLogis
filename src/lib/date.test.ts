import { describe, expect, it } from "vitest"

import {
  addDaysToDate,
  formatDateChipLabel,
  formatYearMonth,
  getCurrentMonthRangeInSeoul,
  getMonthRange,
  getPreviousMonthRangeInSeoul,
  getTodayInSeoul,
  getWeekdayLabel,
  isFullMonthRange,
  shiftMonthRange,
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

describe("getMonthRange / shiftMonthRange / isFullMonthRange", () => {
  it("해당 월의 1일~말일을 돌려준다 (윤년 2월 포함)", () => {
    expect(getMonthRange("2026-11-12")).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    })
    expect(getMonthRange("2026-02-10").to).toBe("2026-02-28")
    expect(getMonthRange("2028-02-10").to).toBe("2028-02-29")
    expect(getMonthRange("2026-12-31")).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    })
  })

  it("월을 앞뒤로 옮긴다 (연 경계 포함, 31일에서 짧은 달로 넘어가도 밀리지 않는다)", () => {
    expect(shiftMonthRange("2026-11-12", -1)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    })
    expect(shiftMonthRange("2026-01-15", -1)).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    })
    expect(shiftMonthRange("2026-12-05", 1)).toEqual({
      from: "2027-01-01",
      to: "2027-01-31",
    })
    expect(shiftMonthRange("2026-01-31", 1)).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    })
    expect(shiftMonthRange("2026-03-31", -1).to).toBe("2026-02-28")
  })

  it("정확히 한 달 전체일 때만 월 범위로 본다", () => {
    expect(isFullMonthRange({ from: "2026-11-01", to: "2026-11-30" })).toBe(true)
    expect(isFullMonthRange({ from: "2026-11-01", to: "2026-11-20" })).toBe(false)
    expect(isFullMonthRange({ from: "2026-11-02", to: "2026-11-30" })).toBe(false)
    expect(isFullMonthRange({ from: "2026-10-01", to: "2026-11-30" })).toBe(false)
  })
})

describe("formatYearMonth / getWeekdayLabel", () => {
  it("년월 라벨과 요일 한 글자", () => {
    expect(formatYearMonth("2026-11-01")).toBe("2026년 11월")
    expect(getWeekdayLabel("2026-11-12")).toBe("목")
    expect(getWeekdayLabel("2026-11-09")).toBe("월")
    expect(getWeekdayLabel("2026-11-15")).toBe("일")
  })
})
