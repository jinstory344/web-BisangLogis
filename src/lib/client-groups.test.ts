import { describe, expect, it } from "vitest"

import { collapseByGroup, groupClientsByFirstWord, movePinnedUnit, togglePinnedMany } from "./client-groups"

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

describe("묶음 고정", () => {
  const groupOf = new Map([
    ["1", "조은푸드"],
    ["2", "조은푸드"],
  ])

  it("collapseByGroup: 묶음은 처음 나온 자리에 한 줄로", () => {
    const units = collapseByGroup([{ id: "3" }, { id: "1" }, { id: "4" }, { id: "2" }], groupOf)
    expect(units.map((u) => (u.kind === "one" ? u.item.id : `${u.name}:${u.items.map((i) => i.id)}`))).toEqual([
      "3",
      "조은푸드:1,2",
      "4",
    ])
  })

  it("togglePinnedMany: 하나라도 고정이면 모두 풀고, 아니면 모두 붙이며 개수 제한", () => {
    expect(togglePinnedMany(["9", "1"], ["1", "2"], 10)).toEqual(["9"])
    expect(togglePinnedMany(["9"], ["1", "2"], 10)).toEqual(["9", "1", "2"])
    expect(togglePinnedMany(["9"], ["1", "2"], 2)).toBeNull()
  })

  it("movePinnedUnit: 묶음은 통째로 움직인다", () => {
    expect(movePinnedUnit(["9", "1", "2", "8"], groupOf, "2", -1)).toEqual(["1", "2", "9", "8"])
    expect(movePinnedUnit(["9", "1", "2", "8"], groupOf, "8", -1)).toEqual(["9", "8", "1", "2"])
    expect(movePinnedUnit(["9", "8"], groupOf, "9", -1)).toEqual(["9", "8"])
  })
})
