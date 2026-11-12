import { parseCopyId } from "@/lib/quick-entry"

import { NewExpenseBody } from "./new-expense-body"

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string | string[] }>
}) {
  const { copy } = await searchParams

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">지출 등록</h1>
      <NewExpenseBody copyId={parseCopyId(copy)} />
    </div>
  )
}
