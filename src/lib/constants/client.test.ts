import { describe, expect, it } from "vitest"

import {
  CLIENT_CATEGORY_LABELS,
  CLIENT_CATEGORY_OPTIONS,
  DEFAULT_CLIENT_CATEGORY,
  normalizeClientCategory,
  parseClientCategoryFilter,
} from "./client"

describe("거래처 구분 상수", () => {
  it("내 거래처·타 거래처 두 가지이고 기본값은 내 거래처다", () => {
    expect(CLIENT_CATEGORY_LABELS).toEqual({
      MINE: "내 거래처",
      OTHER: "타 거래처",
    })
    expect(CLIENT_CATEGORY_OPTIONS).toEqual([
      { value: "MINE", label: "내 거래처" },
      { value: "OTHER", label: "타 거래처" },
    ])
    expect(DEFAULT_CLIENT_CATEGORY).toBe("MINE")
  })
})

describe("normalizeClientCategory", () => {
  it("OTHER만 타 거래처이고 비었거나 알 수 없는 값은 모두 내 거래처다", () => {
    expect(normalizeClientCategory("OTHER")).toBe("OTHER")
    expect(normalizeClientCategory("MINE")).toBe("MINE")
    for (const value of [undefined, null, "", "other", "BOGUS", 1, {}]) {
      expect(normalizeClientCategory(value)).toBe("MINE")
    }
  })
})

describe("parseClientCategoryFilter (?category= 값)", () => {
  it("MINE/OTHER는 그대로, 나머지는 전체로 본다", () => {
    expect(parseClientCategoryFilter("MINE")).toBe("MINE")
    expect(parseClientCategoryFilter("OTHER")).toBe("OTHER")
    expect(parseClientCategoryFilter(undefined)).toBe("ALL")
    expect(parseClientCategoryFilter("")).toBe("ALL")
    expect(parseClientCategoryFilter("ALL")).toBe("ALL")
    expect(parseClientCategoryFilter("mine")).toBe("ALL")
    expect(parseClientCategoryFilter("BOGUS")).toBe("ALL")
  })

  it("같은 파라미터가 여러 번 오면 첫 값을 쓴다", () => {
    expect(parseClientCategoryFilter(["OTHER", "MINE"])).toBe("OTHER")
    expect(parseClientCategoryFilter([])).toBe("ALL")
  })
})
