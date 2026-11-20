import { describe, expect, it } from "vitest"

import { monthCells, salePayText, shortMonthDay } from "./sales-pay-text"

describe("입금 날짜 메뉴", () => {
  it("2026년 11월: 1일이 일요일 → 월요일 시작이라 앞에 빈칸 6개, 30일까지", () => {
    const cells = monthCells("2026-11")
    expect(cells.slice(0, 7)).toEqual([null, null, null, null, null, null, "2026-11-01"])
    expect(cells.at(-1)).toBe("2026-11-30")
    expect(cells.filter(Boolean)).toHaveLength(30)
  })
  it("2월 윤년", () => {
    expect(monthCells("2028-02").filter(Boolean)).toHaveLength(29)
  })
  it("글자", () => {
    expect(shortMonthDay("2026-11-05")).toBe("11/5")
    expect(salePayText({ total_amount: 330000, origin: "피셔", destination: "칠곡", source_minor: "우영로지스" })).toEqual({
      title: "330,000원 입금 처리할까요?",
      caption: "피셔 → 칠곡 · 우영로지스",
    })
  })
})
