import { describe, expect, it } from "vitest"

import {
  buildDonutSegments,
  DONUT_COLORS,
  DONUT_OTHER_COLOR,
  DONUT_OTHER_LABEL,
  donutColorOf,
} from "./donut"

describe("buildDonutSegments", () => {
  it("큰 순서로 비율과 시작 각도를 계산한다", () => {
    const s = buildDonutSegments([
      { label: "생활", value: 25 },
      { label: "차량", value: 75 },
    ])
    expect(s.map((x) => x.label)).toEqual(["차량", "생활"])
    expect(s[0]).toMatchObject({ ratio: 0.75, start: 0, color: DONUT_COLORS[0] })
    expect(s[1]).toMatchObject({ ratio: 0.25, start: 0.75 })
  })

  it("0 이하는 빼고, 합계가 0이면 빈 배열", () => {
    expect(buildDonutSegments([{ label: "a", value: 0 }])).toEqual([])
    expect(buildDonutSegments([{ label: "a", value: 5 }, { label: "b", value: 0 }])).toHaveLength(1)
  })

  it("조각이 많으면 나머지를 '그 외'로 묶는다", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ label: `x${i}`, value: 10 - i }))
    const s = buildDonutSegments(items, 4)
    expect(s).toHaveLength(4)
    expect(s[3]).toMatchObject({ label: DONUT_OTHER_LABEL, value: 7 + 6 + 5 + 4 + 3, color: DONUT_OTHER_COLOR })
    expect(s.reduce((sum, x) => sum + x.ratio, 0)).toBeCloseTo(1)
    expect(donutColorOf(s, "x0")).toBe(DONUT_COLORS[0])
    expect(donutColorOf(s, "x7")).toBe(DONUT_OTHER_COLOR)
  })
})
