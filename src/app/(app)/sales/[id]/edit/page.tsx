import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import type { SaleFormValues } from "@/lib/validations/sales"

import { updateSaleAction } from "../../actions"
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

  const defaultValues: SaleFormValues = {
    sale_date: sale.sale_date,
    origin: sale.origin,
    destination: sale.destination,
    supply_amount: sale.supply_amount,
    is_vat_exempt: sale.is_vat_exempt,
    payment_method: sale.payment_method,
    source_major: sale.source_major ?? "",
    source_minor: sale.source_minor ?? "",
    source_note: sale.source_note ?? "",
    billing_entity_name: sale.billing_entity_name ?? "",
    order_contact_phone: sale.order_contact_phone ?? "",
    memo: sale.memo ?? "",
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">매출 수정</h1>
      <div className="mt-4 max-w-lg">
        <SalesForm
          action={updateSaleAction.bind(null, id)}
          defaultValues={defaultValues}
          submitLabel="저장"
        />
      </div>
    </div>
  )
}
