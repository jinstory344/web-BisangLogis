import { describe, expect, it } from "vitest"

import {
  groupSalesByDay,
  pickStatusTotals,
  summarizeByPaymentStatus,
} from "./sales-list"

const sale = (
  sale_date: string,
  supply_amount: number,
  payment_status: "PAID" | "UNPAID" = "UNPAID",
  total_amount = Math.round(supply_amount * 1.1)
) => ({ sale_date, supply_amount, payment_status, total_amount })

describe("groupSalesByDay (날짜별 묶음)", () => {
  it("같은 날짜끼리 묶고 입력 순서(최근 날짜 먼저)와 묶음 안 순서를 지킨다", () => {
    const rows = [
      { ...sale("2026-11-12", 300000), id: "a" },
      { ...sale("2026-11-12", 200000), id: "b" },
      { ...sale("2026-11-11", 200000), id: "c" },
      { ...sale("2026-11-09", 200000), id: "d" },
      { ...sale("2026-11-09", 280000), id: "e" },
    ]

    const groups = groupSalesByDay(rows)

    expect(groups.map((g) => g.date)).toEqual([
      "2026-11-12",
      "2026-11-11",
      "2026-11-09",
    ])
    expect(groups.map((g) => g.rows.map((r) => r.id))).toEqual([
      ["a", "b"],
      ["c"],
      ["d", "e"],
    ])
  })

  it("그날 공급가액 합계를 구한다 (세액 제외)", () => {
    const groups = groupSalesByDay([
      sale("2026-11-12", 300000),
      sale("2026-11-12", 200000),
      sale("2026-11-09", 480000),
    ])
    expect(groups.map((g) => g.supplyAmount)).toEqual([500000, 480000])
  })

  it("행이 없으면 빈 배열이다", () => {
    expect(groupSalesByDay([])).toEqual([])
  })
})

describe("summarizeByPaymentStatus (상단 요약)", () => {
  const rows = [
    sale("2026-11-12", 300000, "UNPAID", 330000),
    sale("2026-11-12", 200000, "PAID", 220000),
    sale("2026-11-11", 100000, "UNPAID", 110000),
  ]

  it("전체·미입금·입금완료의 건수, 공급가액, 합계금액을 따로 센다", () => {
    expect(summarizeByPaymentStatus(rows)).toEqual({
      all: { count: 3, supplyAmount: 600000, totalAmount: 660000 },
      unpaid: { count: 2, supplyAmount: 400000, totalAmount: 440000 },
      paid: { count: 1, supplyAmount: 200000, totalAmount: 220000 },
    })
  })

  it("전체는 미입금과 입금완료의 합과 항상 같다", () => {
    const summary = summarizeByPaymentStatus(rows)
    expect(summary.all.supplyAmount).toBe(
      summary.unpaid.supplyAmount + summary.paid.supplyAmount
    )
    expect(summary.all.count).toBe(summary.unpaid.count + summary.paid.count)
  })

  it("행이 없으면 전부 0이다", () => {
    expect(summarizeByPaymentStatus([]).all).toEqual({
      count: 0,
      supplyAmount: 0,
      totalAmount: 0,
    })
  })

  it("pickStatusTotals는 입금여부 필터에 맞는 합계를 고른다", () => {
    const summary = summarizeByPaymentStatus(rows)
    expect(pickStatusTotals(summary, "").count).toBe(3)
    expect(pickStatusTotals(summary, "UNPAID").count).toBe(2)
    expect(pickStatusTotals(summary, "PAID").count).toBe(1)
    expect(pickStatusTotals(summary, "BOGUS").count).toBe(3)
  })
})
