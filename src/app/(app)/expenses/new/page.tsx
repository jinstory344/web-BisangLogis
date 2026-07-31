import { expenseFormDefaults } from "@/lib/validations/expense"

import { createExpenseAction } from "../actions"
import { ExpenseForm } from "../expense-form"

export default function NewExpensePage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">지출 등록</h1>
      <div className="mt-4 max-w-lg">
        <ExpenseForm
          action={createExpenseAction}
          defaultValues={expenseFormDefaults}
          submitLabel="등록"
        />
      </div>
    </div>
  )
}
