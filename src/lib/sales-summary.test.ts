import { describe, expect, it } from "vitest"

import {
  summarizeSalesMonth,
  UNSET_MINOR_LABEL,
  UNSET_SOURCE_LABEL,
} from "./sales-summary"

const sale = (
  source_major: string | null,
  source_minor: string | null,
  supply_amount: number,
  payment_status: "PAID" | "UNPAID" = "UNPAID"
) => ({
  source_major,
  source_minor,
  supply_amount,
  total_amount: Math.round(supply_amount * 1.1),
  payment_status,
})

const rows = [
  sale("거래처", "우영로지스", 200000),
  sale("거래처", "우영로지스", 200000),
  sale("지인", "서정욱", 300000, "PAID"),
  sale("카카오톡", "스마일", 280000),
  sale("거래처", "육대장", 50000),
]

describe("summarizeSalesMonth (매출 월간 집계)", () => {
  it("전체 건수·공급가액·합계금액과 입금/미입금 공급가액을 센다", () => {
    const summary = summarizeSalesMonth(rows)

    expect(summary.count).toBe(5)
    expect(summary.supplyAmount).toBe(1030000)
    expect(summary.totalAmount).toBe(
      rows.reduce((sum, r) => sum + r.total_amount, 0)
    )
    expect(summary.paidSupplyAmount).toBe(300000)
    expect(summary.unpaidSupplyAmount).toBe(730000)
    expect(summary.paidSupplyAmount + summary.unpaidSupplyAmount).toBe(
      summary.supplyAmount
    )
  })

  it("출처 대분류는 정해진 순서로, 소분류는 공급가액이 큰 순으로 묶는다", () => {
    const summary = summarizeSalesMonth(rows)

    expect(summary.byMajor.map((m) => m.major)).toEqual([
      "거래처",
      "지인",
      "카카오톡",
    ])
    const client = summary.byMajor[0]
    expect(client.count).toBe(3)
    expect(client.supplyAmount).toBe(450000)
    expect(client.minors).toEqual([
      { minor: "우영로지스", count: 2, supplyAmount: 400000 },
      { minor: "육대장", count: 1, supplyAmount: 50000 },
    ])
  })

  it("소분류는 건수가 아니라 공급가액이 큰 순이고, 같으면 이름 가나다순이다", () => {
    const summary = summarizeSalesMonth([
      sale("지인", "가나다", 5000),
      sale("지인", "가나다", 5000),
      sale("지인", "가나다", 5000),
      sale("지인", "큰손", 500000),
      sale("지인", "나다라", 30000),
      sale("지인", "다라마", 30000),
    ])

    expect(summary.byMajor[0].minors.map((m) => m.minor)).toEqual([
      "큰손",
      "나다라",
      "다라마",
      "가나다",
    ])
  })

  it("대분류별 합의 합은 전체 공급가액과 같다 (빠지는 값이 없다)", () => {
    const summary = summarizeSalesMonth([
      ...rows,
      sale(null, null, 70000),
      sale("옛출처", "누군가", 30000),
    ])

    expect(summary.byMajor.reduce((sum, m) => sum + m.supplyAmount, 0)).toBe(
      summary.supplyAmount
    )
    expect(summary.byMajor.reduce((sum, m) => sum + m.count, 0)).toBe(
      summary.count
    )
  })

  it("출처가 비어 있으면 '미지정'으로 맨 뒤에, 정해진 목록 밖의 값은 그 앞에 둔다", () => {
    const summary = summarizeSalesMonth([
      sale(null, null, 70000),
      sale("옛출처", "누군가", 30000),
      sale("기타", "x", 10000),
    ])

    expect(summary.byMajor.map((m) => m.major)).toEqual([
      "기타",
      "옛출처",
      UNSET_SOURCE_LABEL,
    ])
    expect(summary.byMajor[2].minors[0].minor).toBe(UNSET_MINOR_LABEL)
  })

  it("행이 없으면 전부 0이고 대분류도 없다", () => {
    const summary = summarizeSalesMonth([])
    expect(summary.count).toBe(0)
    expect(summary.supplyAmount).toBe(0)
    expect(summary.byMajor).toEqual([])
  })
})
