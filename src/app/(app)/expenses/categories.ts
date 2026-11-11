import {
  buildCategoryTree,
  DEFAULT_EXPENSE_CATEGORY_TREE,
  type ExpenseCategoryTree,
} from "@/lib/constants/expense-categories"
import { createClient } from "@/lib/supabase/server"

export interface ExpenseCategories {
  tree: ExpenseCategoryTree
  /**
   * 분류를 직접 추가·삭제할 수 있는지. expense_categories 테이블을 읽었을 때만 true이고,
   * 읽지 못해 기본 목록으로 대신할 때는 false라서 화면에서 "추가·편집"을 숨긴다.
   */
  editable: boolean
}

/**
 * 지출 분류 목록을 DB(expense_categories)에서 읽는다.
 * 테이블이 아직 없거나 읽기에 실패하거나 비어 있으면 기본 목록으로 대신해서 지출 화면은 계속 쓸 수 있다.
 */
export async function getExpenseCategories(): Promise<ExpenseCategories> {
  const fallback: ExpenseCategories = {
    tree: DEFAULT_EXPENSE_CATEGORY_TREE,
    editable: false,
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("expense_categories")
      .select("major, minor, sort_order, created_at")
      .is("deleted_at", null)

    if (error || !data) return fallback

    const tree = buildCategoryTree(data)
    return tree.length > 0 ? { tree, editable: true } : fallback
  } catch {
    return fallback
  }
}
