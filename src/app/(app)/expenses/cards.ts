import { sortCardNames } from "@/lib/constants/expense-cards"
import { createClient } from "@/lib/supabase/server"

export interface ExpenseCards {
  names: string[]
  /** 카드를 추가·편집할 수 있는지. expense_cards 테이블을 읽었을 때만 true (못 읽으면 편집을 숨긴다) */
  editable: boolean
}

/** 지출 카드 목록을 DB(expense_cards)에서 읽는다. 못 읽으면 빈 목록 — 카드 이름 없이도 지출은 저장된다. */
export async function getExpenseCards(): Promise<ExpenseCards> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("expense_cards")
      .select("name, sort_order, created_at")
      .is("deleted_at", null)
    if (error || !data) return { names: [], editable: false }
    return { names: sortCardNames(data), editable: true }
  } catch {
    return { names: [], editable: false }
  }
}
