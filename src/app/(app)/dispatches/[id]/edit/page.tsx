import { notFound } from "next/navigation"

import { safeReturnPath } from "@/lib/return-to"
import { createClient } from "@/lib/supabase/server"
import { dispatchRowToFormValues } from "@/lib/validations/dispatch"

import { updateDispatchAction } from "../../actions"
import { DispatchForm } from "../../dispatch-form"

export default async function EditDispatchPage({
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
          action={updateDispatchAction.bind(null, id, returnTo)}
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
