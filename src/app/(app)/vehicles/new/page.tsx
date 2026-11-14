import { FormPageHeader } from "@/components/form/form-page-header"
import { vehicleFormDefaults } from "@/lib/validations/vehicle"

import { createVehicleAction } from "../actions"
import { VehicleForm } from "../vehicle-form"

export default function NewVehiclePage() {
  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        <FormPageHeader title="차량 등록" backHref="/vehicles" backLabel="차량 정보" />
        <div>
        <VehicleForm
          action={createVehicleAction}
          defaultValues={vehicleFormDefaults}
          submitLabel="등록"
        />
        </div>
      </div>
    </div>
  )
}
