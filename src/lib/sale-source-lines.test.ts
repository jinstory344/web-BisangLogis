import { describe, expect, it } from "vitest"

import { saleSourceLines } from "./sale-source-lines"

describe("saleSourceLines", () => {
  it("하위분류가 있으면 하위분류 · 오더자 두 줄", () => {
    expect(
      saleSourceLines({ source_major: "카카오톡", source_sub: "스마일", source_minor: "김재천" })
    ).toEqual(["스마일", "김재천"])
  })
  it("하위분류만 있고 오더자가 없으면 한 줄", () => {
    expect(
      saleSourceLines({ source_major: "카카오톡", source_sub: "스마일", source_minor: null })
    ).toEqual(["스마일"])
  })
  it("하위분류가 없으면 예전처럼 오더자, 없으면 대분류", () => {
    expect(saleSourceLines({ source_major: "거래처", source_sub: null, source_minor: "우영로지스" })).toEqual(["우영로지스"])
    expect(saleSourceLines({ source_major: "지인", source_minor: null })).toEqual(["지인"])
    expect(saleSourceLines({ source_major: null, source_minor: null })).toEqual(["-"])
  })
})
