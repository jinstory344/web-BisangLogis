import { describe, expect, it } from "vitest"

import {
  entryTypeOfKind,
  isEntryType,
  newEntryHref,
  parseEntryType,
} from "./entry-type"

describe("통합 등록 화면 종류", () => {
  it("알 수 없는 값이면 fallback, 배열이면 첫 값", () => {
    expect(parseEntryType("expense", "sale")).toBe("expense")
    expect(parseEntryType(["dispatch", "sale"], "sale")).toBe("dispatch")
    expect(parseEntryType("bogus", "sale")).toBe("sale")
    expect(parseEntryType(undefined, "expense")).toBe("expense")
  })

  it("isEntryType은 세 종류만 받는다", () => {
    expect(isEntryType("sale")).toBe(true)
    expect(isEntryType("sales")).toBe(false)
    expect(isEntryType(null)).toBe(false)
  })

  it("복사 종류(sales/expenses/dispatches)를 등록 종류로 바꾼다", () => {
    expect(entryTypeOfKind("sales")).toBe("sale")
    expect(entryTypeOfKind("expenses")).toBe("expense")
    expect(entryTypeOfKind("dispatches")).toBe("dispatch")
  })

  it("주소를 만든다 (복사 id는 있을 때만)", () => {
    expect(newEntryHref("sale")).toBe("/new?type=sale")
    expect(newEntryHref("expense", "abc")).toBe("/new?type=expense&copy=abc")
  })
})
