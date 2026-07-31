import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import type { ExpenseFormValues } from "@/lib/validations/expense"

import { updateExpenseAction } from "../../actions"
import { ExpenseForm } from "../../expense-form"

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: expense } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single()

  if (!expense) {
    notFound()
  }

  const defaultValues: ExpenseFormValues = {
    expense_date: expense.expense_date,
    category_major: expense.category_major,
    category_minor: expense.category_minor,
    amount: expense.amount,
    payment_method: expense.payment_method ?? "CARD",
    vendor: expense.vendor ?? "",
    has_tax_invoice: expense.has_tax_invoice,
    memo: expense.memo ?? "",
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">지출 수정</h1>
      <div className="mt-4 max-w-lg">
        <ExpenseForm
          action={updateExpenseAction.bind(null, id)}
          defaultValues={defaultValues}
          submitLabel="저장"
        />
      </div>
    </div>
  )
}
