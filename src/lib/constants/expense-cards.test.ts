import { describe, expect, it } from "vitest"

import { checkCardName, matchCardName, moveCardName, sortCardNames } from "./expense-cards"

describe("expense-cards", () => {
  it("정렬값, 같으면 만든 순서", () => {
    expect(
      sortCardNames([
        { name: "B", sort_order: 20, created_at: "2026-01-01" },
        { name: "C", sort_order: 10, created_at: "2026-01-02" },
        { name: "A", sort_order: 10, created_at: "2026-01-01" },
      ])
    ).toEqual(["A", "C", "B"])
  })

  it("이름 검사: 빈칸·길이·중복, 이름 바꾸기는 자기 이름 허용", () => {
    expect(checkCardName(["신한복지"], "  ").ok).toBe(false)
    expect(checkCardName(["신한복지"], "가".repeat(21)).ok).toBe(false)
    expect(checkCardName(["신한복지"], " 신한복지 ").ok).toBe(false)
    expect(checkCardName(["신한복지"], "신한복지", "신한복지")).toEqual({ ok: true, name: "신한복지" })
    expect(checkCardName([], " 우리  기업 ")).toEqual({ ok: true, name: "우리 기업" })
  })

  it("순서 옮기기", () => {
    expect(moveCardName(["a", "b", "c"], "b", -1)).toEqual({ ok: true, names: ["b", "a", "c"] })
    expect(moveCardName(["a", "b"], "a", -1).ok).toBe(false)
    expect(moveCardName(["a", "b"], "b", 1).ok).toBe(false)
    expect(moveCardName(["a"], "x", 1).ok).toBe(false)
  })

  it("텔레그램 낱말 맞추기", () => {
    expect(matchCardName(["신한 RPM"], "신한rpm")).toBe("신한 RPM")
    expect(matchCardName(["신한복지"], "신한")).toBeNull()
    expect(matchCardName(["신한복지"], "")).toBeNull()
    // 뒤에 "카드"를 붙여도 된다
    const cards = ["신한", "신한복지", "현대", "국민"]
    expect(matchCardName(cards, "신한")).toBe("신한")
    expect(matchCardName(cards, "신한카드")).toBe("신한")
    expect(matchCardName(cards, "신한복지 카드")).toBe("신한복지")
    expect(matchCardName(cards, "카드")).toBeNull()
  })
})
