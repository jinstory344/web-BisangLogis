import { describe, expect, it } from "vitest"

import { summarizeDispatchMonth, UNSET_DRIVER_LABEL } from "./dispatch-summary"

const row = (
  client_id: string | null,
  driver_name_snapshot: string | null,
  freight_amount: number | null,
  fee_amount = 0
) => ({ client_id, driver_name_snapshot, freight_amount, fee_amount })

const rows = [
  row("a", "김기사", 300000, 30000),
  row("a", "김기사", 200000),
  row("b", "이기사", 400000),
  row("b", null, null, 10000),
  row("c", "  박기사  ", 100000),
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

  it("기사별로 묶고 운임이 큰 순으로 정렬하며, 이름 앞뒤 공백은 지운다", () => {
    const summary = summarizeDispatchMonth(rows)
    expect(summary.byDriver.map((d) => d.driver)).toEqual([
      "김기사",
      "이기사",
      "박기사",
      UNSET_DRIVER_LABEL,
    ])
    const kim = summary.byDriver.find((d) => d.driver === "김기사")
    expect(kim).toEqual({
      driver: "김기사",
      count: 2,
      freightAmount: 500000,
      feeAmount: 30000,
    })
  })

  it("기사가 비어 있는 건은 '기사 미정'으로 맨 뒤에 모은다 (운임이 커도 뒤)", () => {
    const summary = summarizeDispatchMonth([
      row("a", null, 900000),
      row("a", "김기사", 1000),
    ])
    expect(summary.byDriver.map((d) => d.driver)).toEqual([
      "김기사",
      UNSET_DRIVER_LABEL,
    ])
  })

  it("건수가 적어도 운임이 크면 앞에 온다 (운임이 먼저)", () => {
    const summary = summarizeDispatchMonth([
      row("a", "많이", 1000),
      row("a", "많이", 1000),
      row("a", "많이", 1000),
      row("a", "큰건", 900000),
    ])
    expect(summary.byDriver.map((d) => d.driver)).toEqual(["큰건", "많이"])
  })

  it("운임이 같으면 건수 많은 순, 그래도 같으면 이름 가나다순이다", () => {
    const summary = summarizeDispatchMonth([
      row("a", "다라", 100),
      row("a", "나다", 50),
      row("a", "나다", 50),
      row("a", "가나", 100),
    ])
    expect(summary.byDriver.map((d) => d.driver)).toEqual(["나다", "가나", "다라"])
  })

  it("기사별 합은 전체와 같다 (빠지는 건이 없다)", () => {
    const summary = summarizeDispatchMonth(rows)
    expect(summary.byDriver.reduce((sum, d) => sum + d.count, 0)).toBe(summary.count)
    expect(summary.byDriver.reduce((sum, d) => sum + d.freightAmount, 0)).toBe(
      summary.freightAmount
    )
    expect(summary.byDriver.reduce((sum, d) => sum + d.feeAmount, 0)).toBe(
      summary.feeAmount
    )
  })

  it("행이 없으면 전부 0이다", () => {
    const summary = summarizeDispatchMonth([])
    expect(summary.count).toBe(0)
    expect(summary.byClient).toEqual([])
    expect(summary.byDriver).toEqual([])
  })
})
