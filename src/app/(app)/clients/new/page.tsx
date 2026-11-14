import { FormPageHeader } from "@/components/form/form-page-header"
import { clientFormDefaults } from "@/lib/validations/client"

import { createClientAction } from "../actions"
import { ClientForm } from "../client-form"

export default function NewClientPage() {
  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        <FormPageHeader title="거래처 등록" backHref="/clients" backLabel="거래처" />
        <div>
        <ClientForm
          action={createClientAction}
          defaultValues={clientFormDefaults}
          submitLabel="등록"
        />
        </div>
      </div>
    </div>
  )
}
