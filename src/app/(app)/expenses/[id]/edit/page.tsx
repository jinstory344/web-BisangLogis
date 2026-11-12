import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { expenseRowToFormValues } from "@/lib/validations/expense"

import { updateExpenseAction } from "../../actions"
import { getExpenseCategories } from "../../categories"
import { ExpenseForm } from "../../expense-form"

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  // 지출 한 건과 분류 목록은 서로 기다릴 필요가 없어 함께 읽는다.
  const [{ data: expense }, categories] = await Promise.all([
    supabase.from("expenses").select("*").eq("id", id).is("deleted_at", null).single(),
    getExpenseCategories(),
  ])

  if (!expense) {
    notFound()
  }

  const defaultValues = expenseRowToFormValues(expense)

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">지출 수정</h1>
      <div className="mt-4 max-w-lg">
        <ExpenseForm
          action={updateExpenseAction.bind(null, id)}
          defaultValues={defaultValues}
          submitLabel="저장"
          categories={categories.tree}
          categoriesEditable={categories.editable}
        />
      </div>
    </div>
  )
}
