/**
 * 5.4 지출 카테고리 정의. 코드 상수로 관리한다(PRD 허용 범위).
 * 확장이 필요해지면 이 상수를 별도 expense_categories 테이블로 옮길 수 있다.
 *
 * 모든 대분류의 소분류 맨 끝에는 "기타"를 둔다 — 선택 시 폼에서 직접 텍스트를
 * 입력받아 그 값을 소분류로 저장하므로, 목록에 없는 값도 허용해야 한다
 * (isValidCategoryPair 참고).
 */
export const EXPENSE_CATEGORIES = [
  {
    major: "차량",
    minors: [
      "유류",
      "요소수",
      "첨가제",
      "하이패스",
      "주차",
      "정비",
      "용품",
      "24시적립금",
      "기타",
    ],
  },
  {
    major: "생활",
    minors: [
      "식비",
      "커피",
      "편의점",
      "우편",
      "숙박",
      "병원",
      "약국",
      "선물",
      "기타",
    ],
  },
  { major: "고정지출", minors: ["관리비", "보험료", "세금", "기타"] },
  {
    major: "금융·세금",
    minors: [
      "대출",
      "부가가치세",
      "종합소득세",
      "지방세",
      "과태료",
      "용차비",
      "기타",
    ],
  },
] as const

export type ExpenseCategoryMajor = (typeof EXPENSE_CATEGORIES)[number]["major"]

export const EXPENSE_CATEGORY_MAJORS = EXPENSE_CATEGORIES.map((c) => c.major)

export function getMinorCategories(major: string): readonly string[] {
  return EXPENSE_CATEGORIES.find((c) => c.major === major)?.minors ?? []
}

/** "기타"가 있는 대분류는 목록에 없는 사용자 지정 소분류 텍스트도 허용한다. */
export function isValidCategoryPair(major: string, minor: string): boolean {
  const minors = getMinorCategories(major)
  if (minors.length === 0) return false
  if (minors.includes(minor)) return true
  return minors.includes("기타") && minor.trim().length > 0
}
