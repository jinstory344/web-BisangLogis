import { vehicleFormDefaults } from "@/lib/validations/vehicle"

import { createVehicleAction } from "../actions"
import { VehicleForm } from "../vehicle-form"
import { VehicleFormHeader } from "../vehicle-form-header"

export default function NewVehiclePage() {
  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        <VehicleFormHeader title="차량 등록" />
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
