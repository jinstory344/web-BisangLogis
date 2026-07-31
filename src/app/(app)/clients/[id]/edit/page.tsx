import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import type { ClientFormValues } from "@/lib/validations/client"

import { updateClientAction } from "../../actions"
import { ClientForm } from "../../client-form"

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single()

  if (!client) {
    notFound()
  }

  const defaultValues: ClientFormValues = {
    name: client.name,
    biz_no: client.biz_no ?? "",
    ceo_name: client.ceo_name ?? "",
    address: client.address ?? "",
    biz_type: client.biz_type ?? "",
    biz_item: client.biz_item ?? "",
    contact_name: client.contact_name ?? "",
    contact_phone: client.contact_phone ?? "",
    contact_email: client.contact_email ?? "",
    memo: client.memo ?? "",
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">거래처 수정</h1>
      <div className="mt-4 max-w-lg">
        <ClientForm
          action={updateClientAction.bind(null, id)}
          defaultValues={defaultValues}
          submitLabel="저장"
        />
      </div>
    </div>
  )
}
