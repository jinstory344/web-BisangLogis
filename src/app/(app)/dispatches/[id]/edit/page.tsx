import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import type { DispatchFormValues } from "@/lib/validations/dispatch"

import { updateDispatchAction } from "../../actions"
import { DispatchForm } from "../../dispatch-form"

export default async function EditDispatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: dispatch } = await supabase
    .from("dispatches")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single()

  if (!dispatch) {
    notFound()
  }

  let clientName = ""
  if (dispatch.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", dispatch.client_id)
      .single()
    clientName = client?.name ?? ""
  }

  const defaultValues: DispatchFormValues = {
    dispatch_date: dispatch.dispatch_date,
    client_id: dispatch.client_id ?? "",
    client_name: clientName,
    origin: dispatch.origin,
    destination: dispatch.destination,
    pallet_count: dispatch.pallet_count ?? undefined,
    vehicle_id: dispatch.vehicle_id ?? "",
    plate_no_snapshot: dispatch.plate_no_snapshot ?? "",
    driver_name_snapshot: dispatch.driver_name_snapshot ?? "",
    driver_phone_snapshot: dispatch.driver_phone_snapshot ?? "",
    carrier_name: dispatch.carrier_name ?? "",
    dispatcher_name: dispatch.dispatcher_name ?? "",
    total_amount: dispatch.total_amount,
    is_vat_exempt: dispatch.is_vat_exempt,
    fee_amount: dispatch.fee_amount,
    payment_method: dispatch.payment_method,
    memo: dispatch.memo ?? "",
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">배차 수정</h1>
      <div className="mt-4 max-w-lg">
        <DispatchForm
          action={updateDispatchAction.bind(null, id)}
          defaultValues={defaultValues}
          defaultClient={
            dispatch.client_id
              ? { id: dispatch.client_id, name: clientName, biz_no: null }
              : null
          }
          submitLabel="저장"
        />
      </div>
    </div>
  )
}
