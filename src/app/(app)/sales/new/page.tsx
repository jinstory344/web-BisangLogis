import { saleFormDefaults } from "@/lib/validations/sales"

import { createSaleAction } from "../actions"
import { SalesForm } from "../sales-form"

export default function NewSalesPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">매출 등록</h1>
      <div className="mt-4 max-w-lg">
        <SalesForm
          action={createSaleAction}
          defaultValues={saleFormDefaults}
          submitLabel="등록"
        />
      </div>
    </div>
  )
}
