import { CopyNotice } from "@/components/form/copy-notice"
import { getTodayInSeoul } from "@/lib/date"
import { createClient } from "@/lib/supabase/server"
import {
  buildExpenseCopyDefaults,
  expenseFormDefaults,
  type ExpenseFormValues,
} from "@/lib/validations/expense"

import { createExpenseAction } from "../actions"
import { getExpenseCategories } from "../categories"
import { ExpenseForm } from "../expense-form"

/**
 * 이전 건 복사(?copy=id): 삭제되지 않은 지출을 읽어 분류·금액·결제방법·할부·비고를 채우고
 * 날짜만 오늘로. 없는 id·삭제된 건·잘못된 형식이면 조용히 null(빈 폼).
 */
async function loadExpenseCopyDefaults(
  id: string
): Promise<ExpenseFormValues | null> {
  const supabase = await createClient()
  const { data: expense } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  return expense ? buildExpenseCopyDefaults(expense, getTodayInSeoul()) : null
}

/**
 * 지출 등록 본문(복사 안내 + 폼). 단독 페이지와 통합 등록 화면(/new)이 함께 쓴다.
 * copyId가 있으면 그 건을 복사해 채운다(없는 건·삭제된 건이면 빈 폼).
 */
export async function NewExpenseBody({ copyId }: { copyId: string | null }) {
  const [copiedValues, categories] = await Promise.all([
    copyId ? loadExpenseCopyDefaults(copyId) : null,
    getExpenseCategories(),
  ])

  return (
    <>
      {copiedValues ? <CopyNotice /> : null}
      <div className="mt-4 max-w-lg">
        {/* 같은 화면에서 다른 건을 복사하거나 빈 폼으로 돌아올 때 폼 상태를 새로 만든다. */}
        <ExpenseForm
          key={copiedValues ? copyId : "new"}
          action={createExpenseAction}
          defaultValues={copiedValues ?? expenseFormDefaults}
          submitLabel="등록"
          categories={categories.tree}
          categoriesEditable={categories.editable}
        />
      </div>
    </>
  )
}
