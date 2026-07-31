/**
 * 5.4 지출 카테고리 정의. 코드 상수로 관리한다(PRD 허용 범위).
 * 확장이 필요해지면 이 상수를 별도 expense_categories 테이블로 옮길 수 있다.
 */
export const EXPENSE_CATEGORIES = [
  { major: "차량", minors: ["주유비", "하이패스", "정비", "소모품"] },
  { major: "생활", minors: ["식비", "편의점", "숙박비", "병원/약국", "우편"] },
  { major: "고정비", minors: ["법인넘버관리비", "보험료"] },
  {
    major: "금융·세금",
    minors: ["대출", "부가가치세", "종합소득세", "지방세", "과태료", "용차비"],
  },
] as const

export type ExpenseCategoryMajor = (typeof EXPENSE_CATEGORIES)[number]["major"]

export const EXPENSE_CATEGORY_MAJORS = EXPENSE_CATEGORIES.map((c) => c.major)

export function getMinorCategories(major: string): readonly string[] {
  return EXPENSE_CATEGORIES.find((c) => c.major === major)?.minors ?? []
}

export function isValidCategoryPair(major: string, minor: string): boolean {
  return getMinorCategories(major).includes(minor)
}
