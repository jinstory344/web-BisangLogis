import { describe, expect, it } from "vitest"

import {
  formatEntryDate,
  formatManwon,
  isCarServiceCategory,
  isCarTrackedCategory,
  parseKm,
  unitPrice,
} from "./constants"
import {
  carLogsToEntries,
  expensesToCarEntries,
  toAmountRows,
  type CarExpenseInput,
  type CarLogInput,
} from "./entries"
import { expenseNoteLine } from "./expense-note"
import { buildCycleRows, itemHistory, kindSummary, kindTotals, serviceItemCounts, yearTotal } from "./stats"

function expense(partial: Partial<CarExpenseInput> & { id: string }): CarExpenseInput {
  return {
    expense_date: "2026-11-01",
    category_minor: "정비",
    amount: 10000,
    installment_group_id: null,
    installment_no: null,
    installment_months: null,
    card_name: null,
    liters: null,
    odometer_km: null,
    vendor: null,
    memo: null,
    ...partial,
  }
}

function log(partial: Partial<CarLogInput> & { id: string }): CarLogInput {
  return {
    log_date: "2026-11-01",
    kind: "주유",
    amount: 50000,
    liters: null,
    odometer_km: null,
    vendor: null,
    memo: null,
    ...partial,
  }
}

describe("작은 도우미", () => {
  it("parseKm: 빈칸 null, 쉼표·km 무시, 잘못되면 NaN", () => {
    expect(parseKm("")).toBeNull()
    expect(parseKm(" 615,848 ")).toBe(615848)
    expect(parseKm("615848km")).toBe(615848)
    expect(parseKm("12.5")).toBeNaN()
    expect(parseKm("12345678")).toBeNaN()
  })

  it("단가·만 원·날짜", () => {
    expect(unitPrice(198000, 120)).toBe(1650)
    expect(unitPrice(1000, null)).toBeNull()
    expect(formatManwon(3_520_000)).toBe("352만 원")
    expect(formatManwon(5000)).toBe("5,000원")
    expect(formatEntryDate("2026-11-25", "2026-11-30")).toBe("11/25 (수)")
    expect(formatEntryDate("2025-12-03", "2026-11-30")).toBe("25/12/03 (수)")
  })

  it("분류 판별", () => {
    expect(isCarServiceCategory("차량", "정비")).toBe(true)
    expect(isCarServiceCategory("차량", "주유비")).toBe(false)
    expect(isCarTrackedCategory("차량", "요소수")).toBe(true)
    expect(isCarTrackedCategory("차량", "하이패스")).toBe(false)
    expect(isCarTrackedCategory("식비", "정비")).toBe(false)
  })
})

describe("expensesToCarEntries", () => {
  it("할부 묶음은 첫 회차 날짜·총액·1회차 항목으로 하나", () => {
    const rows = [
      expense({ id: "b", expense_date: "2026-12-01", amount: 100000, installment_group_id: "g", installment_no: 2, installment_months: 3 }),
      expense({ id: "a", expense_date: "2026-11-01", amount: 100001, installment_group_id: "g", installment_no: 1, installment_months: 3, odometer_km: 615848, vendor: "완정모터스", card_name: "신한" }),
      expense({ id: "c", expense_date: "2027-01-01", amount: 100000, installment_group_id: "g", installment_no: 3, installment_months: 3 }),
      expense({ id: "d", category_minor: "주유비", liters: 120, amount: 198000 }),
    ]
    const items = [
      { expense_id: "a", car_log_id: null, item: "배터리", amount: null, sort_order: 10 },
      { expense_id: "a", car_log_id: null, item: "엔진오일", amount: 80000, sort_order: 0 },
    ]
    const entries = expensesToCarEntries(rows, items)
    expect(entries).toHaveLength(2)
    const service = entries.find((e) => e.id === "a")!
    expect(service).toMatchObject({
      date: "2026-11-01",
      kind: "정비",
      amount: 300001,
      km: 615848,
      vendor: "완정모터스",
      cardName: "신한",
      installmentMonths: 3,
      items: [
        { item: "엔진오일", amount: 80000 },
        { item: "배터리", amount: null },
      ],
    })
    expect(entries.find((e) => e.id === "d")).toMatchObject({ kind: "주유", liters: 120, installmentMonths: null })
  })

  it("달 합계 줄은 회차 금액 그대로", () => {
    const rows = toAmountRows(
      [
        expense({ id: "a", amount: 100001, installment_group_id: "g", installment_no: 1 }),
        expense({ id: "b", expense_date: "2026-12-01", amount: 100000, installment_group_id: "g", installment_no: 2 }),
      ],
      [log({ id: "l", log_date: "2026-11-05", kind: "세차", amount: 10000 })]
    )
    const nov = kindTotals(rows, "2026-11-01", "2026-11-30", ["정비", "주유", "요소수"])
    expect(nov.total).toBe(110001)
    expect(nov.byKind).toEqual([
      { kind: "정비", total: 100001 },
      { kind: "주유", total: 0 },
      { kind: "요소수", total: 0 },
      { kind: "세차", total: 10000 },
    ])
    expect(yearTotal(rows, "2026")).toBe(210001)
  })
})

describe("정비 항목 통계·이력", () => {
  const logs = carLogsToEntries(
    [
      log({ id: "1", log_date: "2025-12-03", kind: "정비", amount: 90000, odometer_km: 587578, vendor: "완정모터스" }),
      log({ id: "2", log_date: "2026-05-10", kind: "정비", amount: 250000, odometer_km: 601000 }),
      log({ id: "3", log_date: "2026-11-25", kind: "정비", amount: 120000, odometer_km: 615848 }),
      log({ id: "4", log_date: "2026-08-01", kind: "정비", amount: 30000 }),
    ],
    [
      { expense_id: null, car_log_id: "1", item: "엔진오일", amount: 90000, sort_order: 0 },
      { expense_id: null, car_log_id: "2", item: "엔진오일", amount: null, sort_order: 0 },
      { expense_id: null, car_log_id: "2", item: "타이어", amount: 200000, sort_order: 10 },
      { expense_id: null, car_log_id: "3", item: "엔진오일", amount: 120000, sort_order: 0 },
      { expense_id: null, car_log_id: "4", item: "와이퍼", amount: 30000, sort_order: 0 },
    ]
  )

  it("항목별 횟수·합계 (많은 순)", () => {
    expect(serviceItemCounts(logs)).toEqual([
      { item: "엔진오일", count: 3, total: 210000 },
      { item: "타이어", count: 1, total: 200000 },
      { item: "와이퍼", count: 1, total: 30000 },
    ])
  })

  it("항목 이력: 최근부터, 직전 km 차이, 평균 간격, 빈 금액은 null", () => {
    const history = itemHistory(logs, "엔진오일")
    expect(history.count).toBe(3)
    expect(history.total).toBe(210000)
    // (601000-587578 + 615848-601000) / 2 = 14135
    expect(history.averageIntervalKm).toBe(14135)
    expect(history.rows.map((r) => [r.entry.id, r.amount, r.diffKm])).toEqual([
      ["3", 120000, 14848],
      ["2", null, 13422],
      ["1", 90000, null],
    ])
  })

  it("교체 주기: 기록에서 자동 / 직접 고친 값 / 다음 교체", () => {
    const rows = buildCycleRows(
      [
        { id: "c2", item: "타이어", cycle_km: null, manual_date: null, manual_km: null, sort_order: 10 },
        { id: "c1", item: "엔진오일", cycle_km: 15000, manual_date: null, manual_km: null, sort_order: 0 },
        { id: "c3", item: "배터리", cycle_km: 100000, manual_date: "2026-01-02", manual_km: 590000, sort_order: 20 },
        { id: "c4", item: "냉각수", cycle_km: 50000, manual_date: null, manual_km: null, sort_order: 30 },
      ],
      logs
    )
    expect(rows.map((r) => [r.item, r.lastDate, r.lastKm, r.nextKm, r.isManual])).toEqual([
      ["엔진오일", "2026-11-25", 615848, 630848, false],
      ["타이어", "2026-05-10", 601000, null, false],
      ["배터리", "2026-01-02", 590000, 690000, true],
      ["냉각수", null, null, null, false],
    ])
  })
})

describe("kindSummary", () => {
  it("리터 있는 건만으로 단가", () => {
    const entries = carLogsToEntries(
      [
        log({ id: "1", log_date: "2026-11-02", amount: 198000, liters: 120 }),
        log({ id: "2", log_date: "2026-11-10", amount: 100000 }),
        log({ id: "3", log_date: "2026-10-30", amount: 50000, liters: 30 }),
        log({ id: "4", log_date: "2026-11-11", kind: "세차", amount: 10000 }),
      ],
      []
    )
    expect(kindSummary(entries, "주유", "2026-11-01", "2026-11-30")).toEqual({
      count: 2,
      total: 298000,
      liters: 120,
      unitPrice: 1650,
    })
    expect(kindSummary(entries, "세차", "2026-11-01", "2026-11-30").unitPrice).toBeNull()
  })
})

describe("expenseNoteLine", () => {
  const base = {
    category_major: "차량",
    category_minor: "정비",
    liters: null,
    odometer_km: 615848,
    vendor: "환영모터스",
    memo: null,
  }
  it("정비 줄은 항목 이름 · km · 사용처", () => {
    expect(expenseNoteLine(base, ["엔진오일", "배터리"])).toBe("엔진오일 · 배터리 · 615,848km · 환영모터스")
  })
  it("주유비는 리터·km, 다른 분류는 km·항목 없이", () => {
    expect(expenseNoteLine({ ...base, category_minor: "주유비", liters: 120 }, ["무시"])).toBe(
      "120L · 615,848km · 환영모터스"
    )
    expect(expenseNoteLine({ ...base, category_minor: "하이패스", memo: "메모" }, ["무시"])).toBe("환영모터스 · 메모")
  })
})
