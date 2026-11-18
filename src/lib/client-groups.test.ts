import { describe, expect, it } from "vitest"

import { groupClientsByFirstWord } from "./client-groups"

describe("groupClientsByFirstWord", () => {
  it("첫 단어가 같은 두 곳 이상만 묶는다", () => {
    const groups = groupClientsByFirstWord([
      { id: "1", name: "조은푸드 육대장" },
      { id: "2", name: "조은푸드 이화수" },
      { id: "3", name: "조은물류" },
      { id: "4", name: "아토무역 본사" },
    ])
    expect(groups).toEqual([{ name: "조은푸드", ids: ["1", "2"] }])
  })
})
