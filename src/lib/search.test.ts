import { describe, expect, it } from "vitest"

import {
  appendClientIdFilter,
  buildIlikeOrFilter,
  normalizeSearchQuery,
  pickSearchTab,
  SEARCH_MAX_LENGTH,
  sumDispatchTotals,
} from "./search"

describe("normalizeSearchQuery", () => {
  it("비어 있거나 없으면 빈 글자", () => {
    expect(normalizeSearchQuery(undefined)).toBe("")
    expect(normalizeSearchQuery("")).toBe("")
    expect(normalizeSearchQuery("   ")).toBe("")
  })

  it("앞뒤 공백을 지우고 가운데 공백은 하나로", () => {
    expect(normalizeSearchQuery("  평택   부산 ")).toBe("평택 부산")
  })

  it("필터 문법을 깨는 글자와 와일드카드는 뺀다", () => {
    expect(normalizeSearchQuery("a,b(c)%d*e_f\"g'h\\i")).toBe("a b c d e f g h i")
    expect(normalizeSearchQuery("%%%")).toBe("")
  })

  it("배열이면 첫 값만 쓴다", () => {
    expect(normalizeSearchQuery(["식비", "주유"])).toBe("식비")
  })

  it("최대 길이로 자른다", () => {
    expect(normalizeSearchQuery("가".repeat(50))).toHaveLength(SEARCH_MAX_LENGTH)
  })
})

describe("buildIlikeOrFilter", () => {
  it("칸마다 포함 검색을 쉼표로 잇는다", () => {
    expect(buildIlikeOrFilter(["origin", "memo"], "평택")).toBe(
      "origin.ilike.%평택%,memo.ilike.%평택%"
    )
  })
})

describe("appendClientIdFilter", () => {
  it("거래처 id가 없으면 그대로", () => {
    expect(appendClientIdFilter("memo.ilike.%a%", [])).toBe("memo.ilike.%a%")
  })

  it("거래처 id가 있으면 client_id.in을 붙인다", () => {
    expect(appendClientIdFilter("memo.ilike.%a%", ["id1", "id2"])).toBe(
      "memo.ilike.%a%,client_id.in.(id1,id2)"
    )
  })
})

describe("pickSearchTab", () => {
  it("주소에 고른 탭이 있으면 그것", () => {
    expect(pickSearchTab("dispatch", 5, 0)).toBe("dispatch")
    expect(pickSearchTab("ledger", 0, 5)).toBe("ledger")
  })

  it("모르는 값이면 결과에 따라 고른다", () => {
    expect(pickSearchTab("x", 0, 3)).toBe("dispatch")
    expect(pickSearchTab(undefined, 2, 3)).toBe("ledger")
    expect(pickSearchTab(undefined, 0, 0)).toBe("ledger")
  })
})

describe("sumDispatchTotals", () => {
  it("운임·수수료를 더하고 빈 운임은 0으로 친다", () => {
    expect(
      sumDispatchTotals([
        { freight_amount: 300000, fee_amount: 0 },
        { freight_amount: null, fee_amount: 20000 },
        { freight_amount: 150000, fee_amount: 10000 },
      ])
    ).toEqual({ freight: 450000, fee: 30000 })
  })

  it("없으면 0", () => {
    expect(sumDispatchTotals([])).toEqual({ freight: 0, fee: 0 })
  })
})
