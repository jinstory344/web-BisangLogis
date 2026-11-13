/**
 * 매출 출처 목록: 대분류 › 하위분류 (예: 카카오톡 › 스마일). 오더자 이름은 그 아래 따로(source_minor).
 *
 * 목록은 DB의 sale_sources 테이블이 원본이고 앱에서 직접 추가·삭제한다.
 * 지출 분류(expense-categories.ts)와 같은 모양·규칙을 쓰되, 출처에는 "기타(직접 입력)" 하위분류가 없다
 * (하위분류는 고르지 않아도 된다). "거래처" 대분류는 하위분류 대신 거래처 명단에서 고르므로
 * 하위분류를 붙일 수 없고 지울 수도 없다.
 */

import {
  buildCategoryTree,
  checkDeleteCategory,
  checkNewCategory,
  type CategoryCheck,
  type DeleteCategoryInput,
  type ExpenseCategoryTree,
  type NewCategoryInput,
} from "./expense-categories"
import { SOURCE_MAJOR_CLIENT, SOURCE_MAJOR_OPTIONS } from "./source"

/** 대분류 → 하위분류 목록 (지출 분류와 같은 모양, minors = 하위분류) */
export type SaleSourceTree = ExpenseCategoryTree

/** 테이블을 아직 못 읽을 때 쓰는 대체 목록 (하위분류 없이 지금 대분류만) */
export const DEFAULT_SALE_SOURCE_TREE: SaleSourceTree = SOURCE_MAJOR_OPTIONS.map(
  (major) => ({ major, minors: [] })
)

export interface SaleSourceDbRow {
  major: string
  /** null이면 대분류 행 */
  sub: string | null
  sort_order: number
  created_at: string
}

/** DB 행으로 목록을 만든다 (정렬: 정렬값 → 만든 시각 → 이름). */
export function buildSaleSourceTree(rows: readonly SaleSourceDbRow[]): SaleSourceTree {
  return buildCategoryTree(
    rows.map((row) => ({
      major: row.major,
      minor: row.sub,
      sort_order: row.sort_order,
      created_at: row.created_at,
    }))
  )
}

/** 출처를 한 줄로: "카카오톡 › 스마일", 하위분류가 없으면 "카카오톡", 둘 다 없으면 "" */
export function formatSaleSource(
  major: string | null | undefined,
  sub: string | null | undefined
): string {
  const m = major?.trim() ?? ""
  const s = sub?.trim() ?? ""
  if (!m) return ""
  return s ? `${m} › ${s}` : m
}

/** 새 출처를 추가해도 되는지 (거래처 아래에는 하위분류를 만들 수 없다) */
export function checkNewSaleSource(
  tree: SaleSourceTree,
  input: NewCategoryInput
): CategoryCheck {
  if (input.kind === "minor" && input.major === SOURCE_MAJOR_CLIENT) {
    return { ok: false, error: "거래처는 거래처 명단에서 골라요" }
  }
  return checkNewCategory(tree, input)
}

/** 출처를 지워도 되는지 ("거래처"와 마지막 대분류는 지울 수 없다) */
export function checkDeleteSaleSource(
  tree: SaleSourceTree,
  input: DeleteCategoryInput
): { ok: true } | { ok: false; error: string } {
  if (input.minor === undefined && input.major === SOURCE_MAJOR_CLIENT) {
    return { ok: false, error: "'거래처'는 지울 수 없어요" }
  }
  return checkDeleteCategory(tree, input)
}
