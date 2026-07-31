import { dispatchFormDefaults } from "@/lib/validations/dispatch"

import { createDispatchAction } from "../actions"
import { DispatchForm } from "../dispatch-form"

export default function NewDispatchPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">배차 등록</h1>
      <div className="mt-4 max-w-lg">
        <DispatchForm
          action={createDispatchAction}
          defaultValues={dispatchFormDefaults}
          defaultClient={null}
          submitLabel="등록"
        />
      </div>
    </div>
  )
}
