import { describe, expect, it } from "vitest"

import {
  addMonthsClamped,
  checkInstallment,
  installmentLabel,
  splitInstallments,
  summarizeInstallmentGroup,
} from "./installment"

describe("addMonthsClamped", () => {
  it("한 달씩 뒤로, 해를 넘긴다", () => {
    expect(addMonthsClamped("2026-11-16", 1)).toBe("2026-12-16")
    expect(addMonthsClamped("2026-11-16", 2)).toBe("2027-01-16")
  })
  it("그 달에 없는 날은 말일로", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28")
    expect(addMonthsClamped("2027-12-31", 2)).toBe("2028-02-29")
    expect(addMonthsClamped("2026-08-31", 1)).toBe("2026-09-30")
  })
})

describe("splitInstallments", () => {
  it("일시불은 한 줄 그대로", () => {
    expect(splitInstallments({ expense_date: "2026-11-16", amount: 50000 }, "g")).toEqual([
      { expense_date: "2026-11-16", amount: 50000, installment_no: null, installment_months: null, installment_group_id: null },
    ])
    expect(splitInstallments({ expense_date: "2026-11-16", amount: 50000, installment_months: 1 }, "g")[0]).toMatchObject({
      installment_months: 1,
      installment_group_id: null,
    })
  })

  it("6개월이면 6줄, 합계는 총액과 같고 나머지는 첫 회차에", () => {
    const parts = splitInstallments({ expense_date: "2026-11-30", amount: 1_000_000, installment_months: 6 }, "g1")
    expect(parts).toHaveLength(6)
    expect(parts.map((p) => p.amount)).toEqual([166_670, 166_666, 166_666, 166_666, 166_666, 166_666])
    expect(parts.reduce((t, p) => t + p.amount, 0)).toBe(1_000_000)
    expect(parts.map((p) => p.expense_date)).toEqual([
      "2026-11-30",
      "2026-12-30",
      "2027-01-30",
      "2027-02-28",
      "2027-03-30",
      "2027-04-30",
    ])
    expect(parts.map((p) => p.installment_no)).toEqual([1, 2, 3, 4, 5, 6])
    expect(new Set(parts.map((p) => p.installment_group_id))).toEqual(new Set(["g1"]))
    expect(parts.every((p) => p.installment_months === 6)).toBe(true)
  })
})

describe("checkInstallment", () => {
  it("총액이 개월 수보다 작으면 막는다", () => {
    expect(checkInstallment(5, 6)).not.toBeNull()
    expect(checkInstallment(6, 6)).toBeNull()
    expect(checkInstallment(1, undefined)).toBeNull()
  })
})

describe("installmentLabel / summarizeInstallmentGroup", () => {
  it("회차 표시", () => {
    expect(installmentLabel(3, 6)).toBe("할부 3/6")
    expect(installmentLabel(null, 6)).toBe("6개월 할부")
    expect(installmentLabel(null, 1)).toBe("")
  })
  it("묶음 → 첫 회차 날짜와 총액", () => {
    expect(
      summarizeInstallmentGroup([
        { expense_date: "2026-12-16", amount: 100, installment_no: 2 },
        { expense_date: "2026-11-16", amount: 101, installment_no: 1 },
      ])
    ).toEqual({ expense_date: "2026-11-16", amount: 201 })
    expect(summarizeInstallmentGroup([])).toBeNull()
  })
})
