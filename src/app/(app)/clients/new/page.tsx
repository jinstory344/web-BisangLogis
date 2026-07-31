import { clientFormDefaults } from "@/lib/validations/client"

import { createClientAction } from "../actions"
import { ClientForm } from "../client-form"

export default function NewClientPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">거래처 등록</h1>
      <div className="mt-4 max-w-lg">
        <ClientForm
          action={createClientAction}
          defaultValues={clientFormDefaults}
          submitLabel="등록"
        />
      </div>
    </div>
  )
}
