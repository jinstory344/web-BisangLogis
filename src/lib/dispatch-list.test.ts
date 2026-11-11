import { describe, expect, it } from "vitest"

import {
  DISPATCH_CLIENT_CHIP_LIMIT,
  filterDispatchesByClient,
  pickClientChips,
  summarizeDispatches,
} from "./dispatch-list"

const row = (
  client_id: string | null,
  freight_amount: number | null,
  fee_amount = 0
) => ({ client_id, freight_amount, fee_amount })

describe("summarizeDispatches (배차 목록 상단 요약)", () => {
  const rows = [
    row("a", 300000, 30000),
    row("a", 200000),
    row("b", null, 10000),
    row("c", 100000),
    row(null, 50000),
  ]

  it("전체 건수·운임·수수료를 센다 (운임 미입력은 0)", () => {
    const summary = summarizeDispatches(rows)
    expect(summary.count).toBe(5)
    expect(summary.freightAmount).toBe(650000)
    expect(summary.feeAmount).toBe(40000)
  })

  it("거래처별로 묶고 건수가 많은 순으로 정렬한다 (같으면 운임이 큰 순)", () => {
    const summary = summarizeDispatches(rows)
    expect(summary.byClient.map((c) => c.clientId)).toEqual(["a", "c", "b"])
    expect(summary.byClient[0]).toEqual({
      clientId: "a",
      count: 2,
      freightAmount: 500000,
      feeAmount: 30000,
    })
  })

  it("운임이 커도 건수가 적으면 뒤로 간다 (건수가 먼저, 같을 때만 운임)", () => {
    const summary = summarizeDispatches([
      row("many", 10000),
      row("many", 10000),
      row("many", 10000),
      row("big", 900000),
    ])
    expect(summary.byClient.map((c) => c.clientId)).toEqual(["many", "big"])
  })

  it("거래처 없는 건은 전체에는 들어가지만 거래처 칩에는 없다", () => {
    const summary = summarizeDispatches(rows)
    expect(summary.byClient.reduce((sum, c) => sum + c.count, 0)).toBe(4)
    expect(summary.count).toBe(5)
  })

  it("건수·운임이 같으면 id 순으로 고정한다", () => {
    const summary = summarizeDispatches([row("z", 100), row("m", 100)])
    expect(summary.byClient.map((c) => c.clientId)).toEqual(["m", "z"])
  })

  it("행이 없으면 전부 0이다", () => {
    const summary = summarizeDispatches([])
    expect(summary).toEqual({
      count: 0,
      freightAmount: 0,
      feeAmount: 0,
      byClient: [],
    })
  })
})

describe("filterDispatchesByClient", () => {
  const rows = [row("a", 1), row("b", 2), row(null, 3)]

  it("빈 문자열이면 거르지 않고, 아니면 그 거래처만 남긴다", () => {
    expect(filterDispatchesByClient(rows, "")).toHaveLength(3)
    expect(filterDispatchesByClient(rows, "a")).toHaveLength(1)
    expect(filterDispatchesByClient(rows, "zzz")).toHaveLength(0)
  })
})

describe("pickClientChips", () => {
  const many = Array.from({ length: 9 }, (_, i) => ({
    clientId: `c${i}`,
    count: 20 - i,
    freightAmount: 0,
    feeAmount: 0,
  }))

  it("앞쪽 limit곳만 보여 준다", () => {
    expect(pickClientChips(many, "")).toHaveLength(DISPATCH_CLIENT_CHIP_LIMIT)
  })

  it("선택된 거래처가 밖에 있으면 뒤에 덧붙인다", () => {
    const chips = pickClientChips(many, "c8")
    expect(chips).toHaveLength(DISPATCH_CLIENT_CHIP_LIMIT + 1)
    expect(chips[chips.length - 1].clientId).toBe("c8")
  })

  it("선택된 거래처가 이번 기간 배차가 없어도 건수 0으로 보여 준다", () => {
    const chips = pickClientChips(many, "새거래처")
    expect(chips[chips.length - 1]).toEqual({
      clientId: "새거래처",
      count: 0,
      freightAmount: 0,
      feeAmount: 0,
    })
  })

  it("이미 앞쪽에 있으면 중복해서 붙이지 않는다", () => {
    expect(pickClientChips(many, "c1")).toHaveLength(DISPATCH_CLIENT_CHIP_LIMIT)
  })
})
