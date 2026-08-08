import { createDispatchActionForSales } from "@/app/(app)/dispatches/actions"
import { dispatchFormDefaults } from "@/lib/validations/dispatch"

import { SalesForm } from "../sales-form"

export default function NewSalesPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">매출 등록</h1>
      <div className="mt-4 max-w-lg">
        <SalesForm
          action={createDispatchActionForSales}
          defaultValues={{ ...dispatchFormDefaults, payment_method: "TAX_INVOICE" }}
          defaultClient={null}
          submitLabel="등록"
        />
      </div>
    </div>
  )
}
