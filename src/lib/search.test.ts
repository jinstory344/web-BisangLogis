import { describe, expect, it } from "vitest"

import { buildIlikeOrFilter, normalizeSearchQuery, SEARCH_MAX_LENGTH } from "./search"

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
