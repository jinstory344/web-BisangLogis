/**
 * 지출 분류(대분류 → 소분류).
 *
 * 분류 목록은 DB의 expense_categories 테이블이 원본이고, 앱에서 직접 추가·삭제할 수 있다.
 * 이 파일의 DEFAULT_EXPENSE_CATEGORY_TREE는 처음 넣어 둔 분류이며, 테이블을 아직 못 읽을 때의 대체 목록이다
 * (마이그레이션 20261112000001의 시작 데이터와 같다).
 *
 * 모든 대분류의 소분류 맨 끝에는 "기타"가 있다 — 선택하면 폼에서 직접 텍스트를 입력받아 그 값을
 * 소분류로 저장하므로, 목록에 없는 값도 허용해야 한다 (isValidCategoryPairIn 참고).
 */

export interface ExpenseCategoryNode {
  major: string
  /** 화면에 보여 줄 순서대로, "기타"는 맨 뒤 */
  minors: string[]
}

export type ExpenseCategoryTree = ExpenseCategoryNode[]

/** 이 소분류를 고르면 폼에 직접 입력칸이 열리고, 입력한 글자가 소분류로 저장된다. */
export const CUSTOM_MINOR = "기타"
/** "기타"가 항상 맨 뒤에 오도록 DB에 넣는 정렬값 */
export const CUSTOM_MINOR_SORT_ORDER = 9999
/** 분류 이름 최대 글자 수 (DB 제약과 같다) */
export const MAX_CATEGORY_NAME_LENGTH = 20

export const DEFAULT_EXPENSE_CATEGORY_TREE: ExpenseCategoryTree = [
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
]

/** expense_categories 테이블에서 읽어 온 행 중 목록을 만드는 데 쓰는 열 */
export interface ExpenseCategoryDbRow {
  major: string
  /** null이면 대분류 행 */
  minor: string | null
  sort_order: number
  created_at: string
}

function compareRows(a: ExpenseCategoryDbRow, b: ExpenseCategoryDbRow): number {
  return (
    a.sort_order - b.sort_order ||
    (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0) ||
    (a.minor ?? a.major).localeCompare(b.minor ?? b.major, "ko")
  )
}

/**
 * DB 행(대분류 행 + 소분류 행)으로 분류 목록을 만든다.
 * 대분류와 소분류는 각각 정렬값 → 만든 시각 → 이름 순이고, "기타"는 항상 소분류 맨 뒤다.
 * 대분류 행이 없는 소분류는 어느 대분류에도 붙일 수 없어 버린다.
 */
export function buildCategoryTree(
  rows: readonly ExpenseCategoryDbRow[]
): ExpenseCategoryTree {
  const majors = rows.filter((row) => row.minor === null).sort(compareRows)
  const minorRows = rows.filter((row) => row.minor !== null)

  return majors.map(({ major }) => {
    const minors = minorRows
      .filter((row) => row.major === major)
      .sort((a, b) => {
        const aCustom = a.minor === CUSTOM_MINOR
        const bCustom = b.minor === CUSTOM_MINOR
        if (aCustom !== bCustom) return aCustom ? 1 : -1
        return compareRows(a, b)
      })
      .map((row) => row.minor as string)
    return { major, minors }
  })
}

export function getMajors(tree: ExpenseCategoryTree): string[] {
  return tree.map((node) => node.major)
}

export function getMinorsOf(
  tree: ExpenseCategoryTree,
  major: string
): readonly string[] {
  return tree.find((node) => node.major === major)?.minors ?? []
}

/** "기타"가 있는 대분류는 목록에 없는 사용자 지정 소분류 텍스트도 허용한다. */
export function isValidCategoryPairIn(
  tree: ExpenseCategoryTree,
  major: string,
  minor: string
): boolean {
  const minors = getMinorsOf(tree, major)
  if (minors.length === 0) return false
  if (minors.includes(minor)) return true
  return minors.includes(CUSTOM_MINOR) && minor.trim().length > 0
}

/** 앞뒤 공백을 지우고 안쪽 연속 공백은 한 칸으로 줄인다. */
export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ")
}

export type NewCategoryInput =
  | { kind: "major"; name: string }
  | { kind: "minor"; major: string; name: string }

export type CategoryCheck =
  | { ok: true; name: string }
  | { ok: false; error: string }

/** 새 분류를 추가해도 되는지 검사한다 (이름 길이·중복·"기타" 예약). */
export function checkNewCategory(
  tree: ExpenseCategoryTree,
  input: NewCategoryInput
): CategoryCheck {
  const name = normalizeCategoryName(input.name)
  if (!name) return { ok: false, error: "이름을 입력하세요" }
  if (name.length > MAX_CATEGORY_NAME_LENGTH) {
    return {
      ok: false,
      error: `이름은 ${MAX_CATEGORY_NAME_LENGTH}자 이하로 입력하세요`,
    }
  }

  if (input.kind === "major") {
    if (tree.some((node) => node.major === name)) {
      return { ok: false, error: "이미 있는 대분류예요" }
    }
    return { ok: true, name }
  }

  const node = tree.find((n) => n.major === input.major)
  if (!node) return { ok: false, error: "대분류를 찾을 수 없어요" }
  if (name === CUSTOM_MINOR || node.minors.includes(name)) {
    return { ok: false, error: "이미 있는 소분류예요" }
  }
  return { ok: true, name }
}

export type DeleteCategoryInput = { major: string; minor?: string }

/** 분류를 지워도 되는지 검사한다 ("기타"와 마지막 대분류는 지울 수 없다). */
export function checkDeleteCategory(
  tree: ExpenseCategoryTree,
  input: DeleteCategoryInput
): { ok: true } | { ok: false; error: string } {
  const node = tree.find((n) => n.major === input.major)
  if (!node) return { ok: false, error: "분류를 찾을 수 없어요" }

  if (input.minor === undefined) {
    if (tree.length <= 1) {
      return { ok: false, error: "대분류는 하나 이상 있어야 해요" }
    }
    return { ok: true }
  }

  if (input.minor === CUSTOM_MINOR) {
    return { ok: false, error: "'기타'는 지울 수 없어요" }
  }
  if (!node.minors.includes(input.minor)) {
    return { ok: false, error: "분류를 찾을 수 없어요" }
  }
  return { ok: true }
}

/** 새로 추가하는 행의 정렬값: 지금 있는 값(기타 제외) 중 가장 큰 값 + 10 */
export function nextSortOrder(existing: readonly number[]): number {
  const regular = existing.filter((value) => value < CUSTOM_MINOR_SORT_ORDER)
  return (regular.length > 0 ? Math.max(...regular) : 0) + 10
}
