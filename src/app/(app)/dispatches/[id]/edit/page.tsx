import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { dispatchRowToFormValues } from "@/lib/validations/dispatch"

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

  const defaultValues = dispatchRowToFormValues(dispatch, clientName)

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
