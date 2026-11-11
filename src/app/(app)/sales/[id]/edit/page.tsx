import Link from "next/link"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { saleRowToFormValues } from "@/lib/validations/sales"

import { updateSaleAction } from "../../actions"
import { getSaleClientChoices } from "../../client-choices"
import { SalesForm } from "../../sales-form"

export default async function EditSalePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: sale } = await supabase
    .from("sales")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single()

  if (!sale) {
    notFound()
  }

  const defaultValues = saleRowToFormValues(sale)
  // 거래처 명단은 부가 기능이라 조회 실패 시 비운다 (수정 화면은 계속 쓸 수 있다).
  const clientChoices = await getSaleClientChoices().catch(() => [])

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">매출 수정</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/sales">리스트</Link>
        </Button>
      </div>
      <div className="mt-4 max-w-lg">
        <SalesForm
          action={updateSaleAction.bind(null, id)}
          defaultValues={defaultValues}
          clientChoices={clientChoices}
          submitLabel="저장"
        />
      </div>
    </div>
  )
}
