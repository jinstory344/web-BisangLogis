import { describe, expect, it } from "vitest"

import { safeReturnPath, withReturnTo } from "./return-to"

describe("safeReturnPath", () => {
  it("앱 안의 경로는 그대로", () => {
    expect(safeReturnPath("/")).toBe("/")
    expect(safeReturnPath("/sales?from=2026-11-01&to=2026-11-30")).toBe(
      "/sales?from=2026-11-01&to=2026-11-30"
    )
    expect(safeReturnPath("/search?q=부산")).toBe("/search?q=부산")
  })

  it("바깥 사이트·이상한 값은 null", () => {
    for (const bad of [
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
      "evil",
      "",
      "/a\nb",
      "/" + "a".repeat(600),
      undefined,
      null,
      123,
    ]) {
      expect(safeReturnPath(bad)).toBeNull()
    }
  })
})

describe("withReturnTo", () => {
  it("돌아갈 주소를 인코딩해서 붙인다", () => {
    expect(withReturnTo("/sales/1/edit", "/?view=week")).toBe(
      "/sales/1/edit?returnTo=%2F%3Fview%3Dweek"
    )
  })

  it("안전하지 않거나 없으면 그대로", () => {
    expect(withReturnTo("/sales/1/edit", "//evil.com")).toBe("/sales/1/edit")
    expect(withReturnTo("/sales/1/edit", null)).toBe("/sales/1/edit")
  })
})
