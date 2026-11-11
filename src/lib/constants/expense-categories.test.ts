import { describe, expect, it } from "vitest"

import {
  buildCategoryTree,
  checkDeleteCategory,
  checkNewCategory,
  DEFAULT_EXPENSE_CATEGORY_TREE,
  getMinorsOf,
  isValidCategoryPairIn,
  nextSortOrder,
  normalizeCategoryName,
  type ExpenseCategoryDbRow,
} from "./expense-categories"

const row = (
  major: string,
  minor: string | null,
  sort_order: number,
  created_at = "2026-11-12T00:00:00Z"
): ExpenseCategoryDbRow => ({ major, minor, sort_order, created_at })

describe("buildCategoryTree (DB 행 → 분류 목록)", () => {
  const rows = [
    row("생활", null, 20),
    row("차량", null, 10),
    row("생활", "기타", 9999),
    row("생활", "커피", 20),
    row("생활", "식비", 10),
    row("차량", "기타", 9999),
    row("차량", "유류", 10),
  ]

  it("대분류·소분류를 정렬값 순으로 만들고 '기타'는 항상 맨 뒤에 둔다", () => {
    expect(buildCategoryTree(rows)).toEqual([
      { major: "차량", minors: ["유류", "기타"] },
      { major: "생활", minors: ["식비", "커피", "기타"] },
    ])
  })

  it("'기타'의 정렬값이 작게 들어와도 맨 뒤다", () => {
    const tree = buildCategoryTree([
      row("차량", null, 10),
      row("차량", "기타", 1),
      row("차량", "유류", 10),
    ])
    expect(tree[0].minors).toEqual(["유류", "기타"])
  })

  it("정렬값이 같으면 만든 시각 순, 그래도 같으면 이름 순이다", () => {
    const tree = buildCategoryTree([
      row("차량", null, 10),
      row("차량", "나중", 10, "2026-11-12T02:00:00Z"),
      row("차량", "먼저", 10, "2026-11-12T01:00:00Z"),
      row("차량", "가나", 20, "2026-11-12T03:00:00Z"),
      row("차량", "다라", 20, "2026-11-12T03:00:00Z"),
    ])
    expect(tree[0].minors).toEqual(["먼저", "나중", "가나", "다라"])
  })

  it("대분류 행이 없는 소분류는 버리고, 행이 없으면 빈 목록이다", () => {
    expect(buildCategoryTree([row("유령", "소분류", 10)])).toEqual([])
    expect(buildCategoryTree([])).toEqual([])
  })

  it("소분류가 없는 대분류도 목록에 있다", () => {
    expect(buildCategoryTree([row("새분류", null, 50)])).toEqual([
      { major: "새분류", minors: [] },
    ])
  })
})

describe("isValidCategoryPairIn", () => {
  const tree = DEFAULT_EXPENSE_CATEGORY_TREE

  it("목록에 있는 조합은 통과한다", () => {
    expect(isValidCategoryPairIn(tree, "차량", "유류")).toBe(true)
  })

  it("없는 대분류는 거부한다", () => {
    expect(isValidCategoryPairIn(tree, "없는분류", "유류")).toBe(false)
  })

  it("'기타'가 있는 대분류는 목록에 없는 소분류 글자도 허용하되 빈 글자는 거부한다", () => {
    expect(isValidCategoryPairIn(tree, "차량", "스로틀바디 교환")).toBe(true)
    expect(isValidCategoryPairIn(tree, "차량", "   ")).toBe(false)
  })

  it("'기타'가 없는 대분류는 목록에 없는 소분류를 거부한다", () => {
    const strict = [{ major: "특별", minors: ["하나"] }]
    expect(isValidCategoryPairIn(strict, "특별", "하나")).toBe(true)
    expect(isValidCategoryPairIn(strict, "특별", "둘")).toBe(false)
  })

  it("getMinorsOf는 없는 대분류에 빈 목록을 돌려준다", () => {
    expect(getMinorsOf(tree, "없는분류")).toEqual([])
  })
})

describe("checkNewCategory (추가 전 검사)", () => {
  const tree = DEFAULT_EXPENSE_CATEGORY_TREE

  it("새 이름이면 앞뒤·안쪽 공백을 정리해 통과한다", () => {
    expect(checkNewCategory(tree, { kind: "major", name: "  사 무  실  " })).toEqual({
      ok: true,
      name: "사 무 실",
    })
    expect(
      checkNewCategory(tree, { kind: "minor", major: "차량", name: " 세차 " })
    ).toEqual({ ok: true, name: "세차" })
  })

  it("빈 이름과 너무 긴 이름은 거부한다", () => {
    expect(checkNewCategory(tree, { kind: "major", name: "   " })).toEqual({
      ok: false,
      error: "이름을 입력하세요",
    })
    const result = checkNewCategory(tree, { kind: "major", name: "가".repeat(21) })
    expect(result.ok).toBe(false)
    expect(
      checkNewCategory(tree, { kind: "major", name: "가".repeat(20) }).ok
    ).toBe(true)
  })

  it("이미 있는 대분류·소분류는 거부한다 (공백만 다른 이름도 같은 이름)", () => {
    expect(checkNewCategory(tree, { kind: "major", name: " 차량 " })).toEqual({
      ok: false,
      error: "이미 있는 대분류예요",
    })
    expect(
      checkNewCategory(tree, { kind: "minor", major: "차량", name: "유류" }).ok
    ).toBe(false)
  })

  it("다른 대분류에 있는 이름은 이 대분류에 추가할 수 있다", () => {
    expect(
      checkNewCategory(tree, { kind: "minor", major: "생활", name: "유류" }).ok
    ).toBe(true)
  })

  it("'기타'는 이미 있어서 만들 수 없고, 없는 대분류 아래에는 추가할 수 없다", () => {
    expect(
      checkNewCategory(tree, { kind: "minor", major: "차량", name: "기타" }).ok
    ).toBe(false)
    expect(
      checkNewCategory(tree, { kind: "minor", major: "없는분류", name: "세차" })
    ).toEqual({ ok: false, error: "대분류를 찾을 수 없어요" })
  })
})

describe("checkDeleteCategory (삭제 전 검사)", () => {
  const tree = DEFAULT_EXPENSE_CATEGORY_TREE

  it("소분류와 대분류는 지울 수 있다", () => {
    expect(checkDeleteCategory(tree, { major: "차량", minor: "주차" })).toEqual({
      ok: true,
    })
    expect(checkDeleteCategory(tree, { major: "생활" })).toEqual({ ok: true })
  })

  it("'기타'는 지울 수 없다", () => {
    expect(checkDeleteCategory(tree, { major: "차량", minor: "기타" }).ok).toBe(
      false
    )
  })

  it("마지막 남은 대분류는 지울 수 없다", () => {
    const last = [{ major: "차량", minors: ["유류", "기타"] }]
    expect(checkDeleteCategory(last, { major: "차량" })).toEqual({
      ok: false,
      error: "대분류는 하나 이상 있어야 해요",
    })
  })

  it("없는 분류는 거부한다", () => {
    expect(checkDeleteCategory(tree, { major: "없는분류" }).ok).toBe(false)
    expect(checkDeleteCategory(tree, { major: "차량", minor: "없는것" }).ok).toBe(
      false
    )
  })
})

describe("normalizeCategoryName / nextSortOrder", () => {
  it("공백을 정리한다", () => {
    expect(normalizeCategoryName("  가   나  ")).toBe("가 나")
  })

  it("새 정렬값은 기타(9999)를 빼고 가장 큰 값 + 10이고, 없으면 10이다", () => {
    expect(nextSortOrder([10, 20, 9999])).toBe(30)
    expect(nextSortOrder([9999])).toBe(10)
    expect(nextSortOrder([])).toBe(10)
  })
})
