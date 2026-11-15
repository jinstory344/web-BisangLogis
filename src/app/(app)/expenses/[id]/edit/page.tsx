import { notFound } from "next/navigation"

import { loadExpenseForForm } from "@/lib/expense-installment-db"
import { safeReturnPath } from "@/lib/return-to"
import { createClient } from "@/lib/supabase/server"
import { expenseRowToFormValues } from "@/lib/validations/expense"

import { updateExpenseAction } from "../../actions"
import { getExpenseCategories } from "../../categories"
import { ExpenseForm } from "../../expense-form"

export default async function EditExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { id } = await params
  // 수정을 시작한 화면 (저장하면 그리로 돌아간다)
  const returnTo = safeReturnPath((await searchParams).returnTo)
  const supabase = await createClient()
  // 지출 한 건과 분류 목록은 서로 기다릴 필요가 없어 함께 읽는다.
  // 할부 회차면 묶음 전체를 한 건처럼(첫 회차 날짜·총액) 띄운다
  const [loaded, categories] = await Promise.all([
    loadExpenseForForm(supabase, id),
    getExpenseCategories(),
  ])

  if (!loaded) {
    notFound()
  }

  const defaultValues = expenseRowToFormValues(loaded.row)

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">지출 수정</h1>
      <div className="mt-4 max-w-lg">
        <ExpenseForm
          action={updateExpenseAction.bind(null, id, returnTo)}
          defaultValues={defaultValues}
          submitLabel="저장"
          categories={categories.tree}
          categoriesEditable={categories.editable}
          installmentGroupSize={loaded.row.installment_group_id ? loaded.groupSize : 0}
        />
      </div>
    </div>
  )
}
