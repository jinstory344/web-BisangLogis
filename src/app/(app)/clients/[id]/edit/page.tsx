import { notFound } from "next/navigation"

import { FormPageHeader } from "@/components/form/form-page-header"
import { normalizeClientCategory } from "@/lib/constants/client"
import { createClient } from "@/lib/supabase/server"
import type { ClientFormValues } from "@/lib/validations/client"

import { getClientContacts, updateClientAction } from "../../actions"
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
  const contacts = (await getClientContacts([id]))[id] ?? []

  const defaultValues: ClientFormValues = {
    name: client.name,
    category: normalizeClientCategory(client.category),
    biz_no: client.biz_no ?? "",
    ceo_name: client.ceo_name ?? "",
    address: client.address ?? "",
    biz_type: client.biz_type ?? "",
    biz_item: client.biz_item ?? "",
    contacts:
      contacts.length > 0
        ? contacts.map((c) => ({ name: c.name, phone: c.phone ?? "" }))
        : [{ name: client.contact_name ?? "", phone: client.contact_phone ?? "" }],
    contact_email: client.contact_email ?? "",
    memo: client.memo ?? "",
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        <FormPageHeader title="거래처 수정" backHref="/clients" backLabel="거래처" />
        <div>
        <ClientForm
          action={updateClientAction.bind(null, id)}
          defaultValues={defaultValues}
          submitLabel="저장"
          clientId={id}
        />
        </div>
      </div>
    </div>
  )
}
