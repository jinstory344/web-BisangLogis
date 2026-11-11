import { describe, expect, it } from "vitest"

import { formatChangeRate, percentOf } from "./summary"

describe("formatChangeRate (전월 대비)", () => {
  it("늘면 +, 줄면 - 퍼센트로 표시한다 (반올림)", () => {
    expect(formatChangeRate(150, 100)).toBe("전월 대비 +50%")
    expect(formatChangeRate(50, 100)).toBe("전월 대비 -50%")
    expect(formatChangeRate(1234, 1000)).toBe("전월 대비 +23%")
  })

  it("같으면 '전월과 동일'이고, 반올림해서 0%여도 동일로 본다", () => {
    expect(formatChangeRate(100, 100)).toBe("전월과 동일")
    expect(formatChangeRate(1004, 1000)).toBe("전월과 동일")
  })

  it("전월이 0이면 비율을 구하지 않고 문구로 알린다 (라벨은 바꿀 수 있다)", () => {
    expect(formatChangeRate(0, 0)).toBe("전월과 동일")
    expect(formatChangeRate(500, 0)).toBe("전월 지출 없음")
    expect(formatChangeRate(500, 0, "매출")).toBe("전월 매출 없음")
  })
})

describe("percentOf", () => {
  it("전체 대비 비율을 반올림해 구하고, 전체가 0이면 0이다", () => {
    expect(percentOf(1, 3)).toBe(33)
    expect(percentOf(2, 3)).toBe(67)
    expect(percentOf(5, 0)).toBe(0)
  })
})
