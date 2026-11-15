import { describe, expect, it } from "vitest"

import {
  collectPeople,
  parseSearchFilters,
  parseSmartQuery,
  searchHref,
  countByMonth,
  inPeriod,
  groupByMonth,
  appendClientIdFilter,
  buildIlikeOrFilter,
  formatSearchDate,
  normalizeSearchQuery,
  parseSearchPeriod,
  parseSearchTab,
  periodLabel,
  presetRange,
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

describe("parseSearchTab", () => {
  it("모르는 값·예전 ledger는 전체, 배차는 그대로", () => {
    expect(parseSearchTab("dispatch")).toBe("dispatch")
    expect(parseSearchTab("ledger")).toBe("all")
    expect(parseSearchTab(undefined)).toBe("all")
    expect(parseSearchTab("sale")).toBe("sale")
  })
})

describe("기간", () => {
  const today = "2026-01-15"
  it("빠른 기간 범위 (해 넘김 포함)", () => {
    expect(presetRange("thisMonth", today)).toEqual({ from: "2026-01-01", to: "2026-01-31" })
    expect(presetRange("lastMonth", today)).toEqual({ from: "2025-12-01", to: "2025-12-31" })
    expect(presetRange("last3Months", today)).toEqual({ from: "2025-11-01", to: "2026-01-31" })
    expect(presetRange("lastYear", today)).toEqual({ from: "2025-01-01", to: "2025-12-31" })
    expect(presetRange("all", today)).toBeNull()
  })
  it("주소의 기간 읽기", () => {
    expect(parseSearchPeriod("2026-11-15", "2026-10-20")).toEqual({ from: "2026-10-20", to: "2026-11-15" })
    expect(parseSearchPeriod("2026-1-1", "2026-02-01")).toBeNull()
    expect(parseSearchPeriod(undefined, "2026-02-01")).toBeNull()
  })
  it("칩 글자", () => {
    expect(periodLabel(null, today)).toBe("기간")
    expect(periodLabel({ from: "2026-01-01", to: "2026-12-31" }, today)).toBe("올해")
    expect(periodLabel({ from: "2026-01-03", to: "2026-01-10" }, today)).toBe("1/3 ~ 1/10")
    expect(periodLabel({ from: "2025-10-20", to: "2026-01-10" }, today)).toBe("25/10/20 ~ 1/10")
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

describe("formatSearchDate", () => {
  it("연도까지, 월·일 앞의 0은 뺀다", () => {
    expect(formatSearchDate("2026-10-02")).toBe("2026. 10. 2.")
    expect(formatSearchDate("2025-01-15")).toBe("2025. 1. 15.")
  })
})

describe("groupByMonth", () => {
  it("달이 바뀔 때마다 묶는다", () => {
    const groups = groupByMonth(["2026-11-16", "2026-11-05", "2026-10-31"], (d) => d)
    expect(groups.map((g) => [g.label, g.rows.length])).toEqual([
      ["2026년 11월", 2],
      ["2026년 10월", 1],
    ])
  })
})

describe("inPeriod / countByMonth", () => {
  it("기간 안 여부와 달별 건수", () => {
    expect(inPeriod("2026-11-03", { from: "2026-11-01", to: "2026-11-30" })).toBe(true)
    expect(inPeriod("2026-10-31", { from: "2026-11-01", to: "2026-11-30" })).toBe(false)
    expect(inPeriod("2026-10-31", null)).toBe(true)
    expect(countByMonth(["2026-11-03", "2026-11-20", "2026-10-01"])).toEqual({ "2026-11": 2, "2026-10": 1 })
  })
})

describe("조건 칩 주소", () => {
  const id = "12956745-839d-4d78-b02e-1ea9363d3c35"
  it("읽고 다시 만든다", () => {
    const f = parseSearchFilters({ client_id: id, client_name: "우영로지스", unpaid: "1", category: "" })
    expect(f).toEqual({ clientId: id, clientName: "우영로지스", category: undefined, unpaid: true })
    expect(searchHref("", "sale", null, f)).toBe(`/search?tab=sale&client_id=${id}&client_name=%EC%9A%B0%EC%98%81%EB%A1%9C%EC%A7%80%EC%8A%A4&unpaid=1`)
    expect(parseSearchFilters({ client_id: "x" }).clientId).toBeUndefined()
  })
})

describe("parseSmartQuery", () => {
  const ctx = {
    today: "2026-11-15",
    clients: [
      { id: "c1", name: "우영로지스" },
      { id: "c2", name: "아토무역" },
      { id: "c3", name: "아토상사" },
    ],
    categories: ["주유비", "식비"],
  }
  it("우영 2026 매출 → 거래처·연도·탭", () => {
    expect(parseSmartQuery("우영 2026 매출", ctx)).toEqual({
      query: "",
      tab: "sale",
      period: { from: "2026-01-01", to: "2026-12-31" },
      filters: { clientId: "c1", clientName: "우영로지스" },
    })
  })
  it("작년 주유비 → 지출 탭·항목", () => {
    expect(parseSmartQuery("작년 주유비", ctx)).toEqual({
      query: "",
      tab: "expense",
      period: { from: "2025-01-01", to: "2025-12-31" },
      filters: { category: "주유비" },
    })
  })
  it("알아들은 말이 없으면 그대로(한 단어 거래처도)", () => {
    expect(parseSmartQuery("우영", ctx)).toBeNull()
    expect(parseSmartQuery("피셔 부산", ctx)).toBeNull()
  })
  it("앞글자가 여러 거래처에 맞으면 글자로 남긴다", () => {
    expect(parseSmartQuery("아토 배차", ctx)).toEqual({ query: "아토", tab: "dispatch", period: undefined, filters: {} })
  })
})

describe("collectPeople", () => {
  it("검색어가 들어간 이름을 역할과 함께 모은다", () => {
    expect(
      collectPeople("승우", [
        { name: "허승우", role: "차주" },
        { name: "양승우", role: "오더자" },
        { name: "허승우", role: "담당자" },
        { name: "김진승", role: "차주" },
        { name: null, role: "차주" },
      ])
    ).toEqual([
      { name: "양승우", roles: ["오더자"] },
      { name: "허승우", roles: ["차주", "담당자"] },
    ])
  })
})
