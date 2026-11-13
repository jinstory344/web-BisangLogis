import { describe, expect, it } from "vitest"

import {
  buildSaleSourceTree,
  checkDeleteSaleSource,
  checkNewSaleSource,
  DEFAULT_SALE_SOURCE_TREE,
  formatSaleSource,
  type SaleSourceTree,
} from "./sale-sources"

const tree: SaleSourceTree = [
  { major: "거래처", minors: [] },
  { major: "카카오톡", minors: ["스마일", "해피"] },
  { major: "지인", minors: [] },
]

describe("buildSaleSourceTree", () => {
  it("대분류 순서대로, 하위분류는 정렬값 순", () => {
    const rows = [
      { major: "카카오톡", sub: null, sort_order: 30, created_at: "2026-01-01" },
      { major: "거래처", sub: null, sort_order: 10, created_at: "2026-01-01" },
      { major: "카카오톡", sub: "해피", sort_order: 20, created_at: "2026-01-01" },
      { major: "카카오톡", sub: "스마일", sort_order: 10, created_at: "2026-01-01" },
      { major: "없는대분류", sub: "고아", sort_order: 10, created_at: "2026-01-01" },
    ]
    expect(buildSaleSourceTree(rows)).toEqual([
      { major: "거래처", minors: [] },
      { major: "카카오톡", minors: ["스마일", "해피"] },
    ])
  })

  it("대체 목록은 지금 대분류 6개, 하위분류 없음", () => {
    expect(DEFAULT_SALE_SOURCE_TREE.map((node) => node.major)).toEqual([
      "거래처",
      "지인",
      "카카오톡",
      "밴드",
      "24시콜화물",
      "기타",
    ])
    expect(DEFAULT_SALE_SOURCE_TREE.every((node) => node.minors.length === 0)).toBe(true)
  })
})

describe("formatSaleSource", () => {
  it("대분류 › 하위분류", () => {
    expect(formatSaleSource("카카오톡", "스마일")).toBe("카카오톡 › 스마일")
    expect(formatSaleSource("카카오톡", "")).toBe("카카오톡")
    expect(formatSaleSource("카카오톡", null)).toBe("카카오톡")
    expect(formatSaleSource(null, "스마일")).toBe("")
    expect(formatSaleSource(" 지인 ", "  ")).toBe("지인")
  })
})

describe("checkNewSaleSource", () => {
  it("하위분류 추가: 이름 정리, 중복 거부", () => {
    expect(checkNewSaleSource(tree, { kind: "minor", major: "카카오톡", name: " 에이스 " })).toEqual({
      ok: true,
      name: "에이스",
    })
    expect(checkNewSaleSource(tree, { kind: "minor", major: "카카오톡", name: "스마일" }).ok).toBe(false)
  })

  it("거래처 아래에는 하위분류를 만들 수 없다", () => {
    expect(checkNewSaleSource(tree, { kind: "minor", major: "거래처", name: "A" }).ok).toBe(false)
  })

  it("대분류 추가: 중복 거부", () => {
    expect(checkNewSaleSource(tree, { kind: "major", name: "문자" }).ok).toBe(true)
    expect(checkNewSaleSource(tree, { kind: "major", name: "지인" }).ok).toBe(false)
  })
})

describe("checkDeleteSaleSource", () => {
  it("거래처 대분류는 지울 수 없다", () => {
    expect(checkDeleteSaleSource(tree, { major: "거래처" }).ok).toBe(false)
  })

  it("다른 대분류·하위분류는 지울 수 있다", () => {
    expect(checkDeleteSaleSource(tree, { major: "지인" }).ok).toBe(true)
    expect(checkDeleteSaleSource(tree, { major: "카카오톡", minor: "해피" }).ok).toBe(true)
    expect(checkDeleteSaleSource(tree, { major: "카카오톡", minor: "없음" }).ok).toBe(false)
  })
})
