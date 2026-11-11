import { describe, expect, it } from "vitest"

import { summarizeDispatchMonth, UNSET_VEHICLE_LABEL } from "./dispatch-summary"

const row = (
  client_id: string | null,
  plate_no_snapshot: string | null,
  driver_name_snapshot: string | null,
  freight_amount: number | null,
  fee_amount = 0
) => ({
  client_id,
  plate_no_snapshot,
  driver_name_snapshot,
  freight_amount,
  fee_amount,
})

const rows = [
  row("a", "서울89자6620", "김기사", 300000, 30000),
  row("a", "서울89자6620", "김기사", 200000),
  row("b", "부산91자4487", "이기사", 400000),
  row("b", null, null, null, 10000),
  row("c", "  경남81아5379  ", "  박기사  ", 100000),
]

describe("summarizeDispatchMonth (배차 월간 집계)", () => {
  it("전체 건수·운임·수수료를 센다 (운임 미입력은 0)", () => {
    const summary = summarizeDispatchMonth(rows)
    expect(summary.count).toBe(5)
    expect(summary.freightAmount).toBe(1000000)
    expect(summary.feeAmount).toBe(40000)
  })

  it("거래처별 합계는 목록 요약과 같은 규칙(건수 많은 순)이다", () => {
    const summary = summarizeDispatchMonth(rows)
    expect(summary.byClient.map((c) => [c.clientId, c.count])).toEqual([
      ["a", 2],
      ["b", 2],
      ["c", 1],
    ])
  })

  it("차량번호로 묶고 기사 이름과 차량번호를 함께 돌려준다 (공백은 지운다)", () => {
    const summary = summarizeDispatchMonth(rows)
    expect(summary.byVehicle.map((v) => [v.driver, v.plate])).toEqual([
      ["김기사", "서울89자6620"],
      ["이기사", "부산91자4487"],
      ["박기사", "경남81아5379"],
      ["", ""],
    ])
    expect(summary.byVehicle[0]).toEqual({
      plate: "서울89자6620",
      driver: "김기사",
      count: 2,
      freightAmount: 500000,
      feeAmount: 30000,
    })
  })

  it("같은 차량이면 기사 이름이 달라도 한 줄로 묶고, 가장 많이 쓰인 이름을 보여 준다", () => {
    const summary = summarizeDispatchMonth([
      row("a", "서울12가3456", "임시기사", 100),
      row("a", "서울12가3456", "김기사", 100),
      row("a", "서울12가3456", "김기사", 100),
    ])
    expect(summary.byVehicle).toHaveLength(1)
    expect(summary.byVehicle[0].driver).toBe("김기사")
    expect(summary.byVehicle[0].count).toBe(3)
  })

  it("같은 기사라도 차량이 다르면 따로 센다", () => {
    const summary = summarizeDispatchMonth([
      row("a", "서울12가3456", "김기사", 100),
      row("a", "부산34나5678", "김기사", 100),
    ])
    expect(summary.byVehicle).toHaveLength(2)
  })

  it("차량번호가 없으면 기사 이름으로 묶는다", () => {
    const summary = summarizeDispatchMonth([
      row("a", null, "김기사", 100),
      row("a", "", "김기사", 100),
    ])
    expect(summary.byVehicle).toEqual([
      { plate: "", driver: "김기사", count: 2, freightAmount: 200, feeAmount: 0 },
    ])
  })

  it("차량번호도 기사 이름도 없는 건은 '차량 미정'으로 맨 뒤에 모은다 (운임이 커도 뒤)", () => {
    const summary = summarizeDispatchMonth([
      row("a", null, null, 900000),
      row("a", "서울12가3456", "김기사", 1000),
    ])
    expect(summary.byVehicle.map((v) => v.driver || v.plate || UNSET_VEHICLE_LABEL)).toEqual([
      "김기사",
      UNSET_VEHICLE_LABEL,
    ])
  })

  it("건수가 적어도 운임이 크면 앞에 온다 (운임이 먼저)", () => {
    const summary = summarizeDispatchMonth([
      row("a", "서울1", "많이", 1000),
      row("a", "서울1", "많이", 1000),
      row("a", "서울1", "많이", 1000),
      row("a", "서울2", "큰건", 900000),
    ])
    expect(summary.byVehicle.map((v) => v.driver)).toEqual(["큰건", "많이"])
  })

  it("운임이 같으면 건수 많은 순, 그래도 같으면 이름 가나다순이다", () => {
    const summary = summarizeDispatchMonth([
      row("a", "p1", "다라", 100),
      row("a", "p2", "나다", 50),
      row("a", "p2", "나다", 50),
      row("a", "p3", "가나", 100),
    ])
    expect(summary.byVehicle.map((v) => v.driver)).toEqual(["나다", "가나", "다라"])
  })

  it("차량별 합은 전체와 같다 (빠지는 건이 없다)", () => {
    const summary = summarizeDispatchMonth(rows)
    expect(summary.byVehicle.reduce((sum, v) => sum + v.count, 0)).toBe(summary.count)
    expect(summary.byVehicle.reduce((sum, v) => sum + v.freightAmount, 0)).toBe(
      summary.freightAmount
    )
    expect(summary.byVehicle.reduce((sum, v) => sum + v.feeAmount, 0)).toBe(
      summary.feeAmount
    )
  })

  it("행이 없으면 전부 0이다", () => {
    const summary = summarizeDispatchMonth([])
    expect(summary.count).toBe(0)
    expect(summary.byClient).toEqual([])
    expect(summary.byVehicle).toEqual([])
  })
})
