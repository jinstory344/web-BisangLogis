import { vehicleFormDefaults } from "@/lib/validations/vehicle"

import { createVehicleAction } from "../actions"
import { VehicleForm } from "../vehicle-form"

export default function NewVehiclePage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">차량 등록</h1>
      <div className="mt-4 max-w-lg">
        <VehicleForm
          action={createVehicleAction}
          defaultValues={vehicleFormDefaults}
          submitLabel="등록"
        />
      </div>
    </div>
  )
}
