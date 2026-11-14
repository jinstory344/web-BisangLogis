import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import type { VehicleFormValues } from "@/lib/validations/vehicle"

import { updateVehicleAction } from "../../actions"
import { VehicleForm } from "../../vehicle-form"
import { VehicleFormHeader } from "../../vehicle-form-header"

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single()

  if (!vehicle) {
    notFound()
  }

  const defaultValues: VehicleFormValues = {
    plate_no: vehicle.plate_no,
    driver_name: vehicle.driver_name,
    driver_phone: vehicle.driver_phone ?? "",
    vehicle_type: vehicle.vehicle_type ?? "",
    pallet_count: vehicle.pallet_count ? String(vehicle.pallet_count) : "",
    memo: vehicle.memo ?? "",
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        <VehicleFormHeader title="차량 정보 수정" />
        <div>
        <VehicleForm
          action={updateVehicleAction.bind(null, id)}
          defaultValues={defaultValues}
          submitLabel="저장"
        />
        </div>
      </div>
    </div>
  )
}
