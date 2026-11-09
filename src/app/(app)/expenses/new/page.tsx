import { CopyNotice } from "@/components/form/copy-notice"
import { getTodayInSeoul } from "@/lib/date"
import { parseCopyId } from "@/lib/quick-entry"
import { createClient } from "@/lib/supabase/server"
import {
  buildExpenseCopyDefaults,
  expenseFormDefaults,
  type ExpenseFormValues,
} from "@/lib/validations/expense"

import { createExpenseAction } from "../actions"
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

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string | string[] }>
}) {
  const { copy } = await searchParams
  const copyId = parseCopyId(copy)
  const copiedValues = copyId ? await loadExpenseCopyDefaults(copyId) : null

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">지출 등록</h1>
      {copiedValues ? <CopyNotice /> : null}
      <div className="mt-4 max-w-lg">
        {/* 같은 화면에서 다른 건을 복사하거나 빈 폼으로 돌아올 때 폼 상태를 새로 만든다. */}
        <ExpenseForm
          key={copiedValues ? copyId : "new"}
          action={createExpenseAction}
          defaultValues={copiedValues ?? expenseFormDefaults}
          submitLabel="등록"
        />
      </div>
    </div>
  )
}
