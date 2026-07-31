import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import type { VehicleFormValues } from "@/lib/validations/vehicle"

import { updateVehicleAction } from "../../actions"
import { VehicleForm } from "../../vehicle-form"

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
    carrier_name: vehicle.carrier_name ?? "",
    vehicle_type: vehicle.vehicle_type ?? "",
    memo: vehicle.memo ?? "",
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">차량 수정</h1>
      <div className="mt-4 max-w-lg">
        <VehicleForm
          action={updateVehicleAction.bind(null, id)}
          defaultValues={defaultValues}
          submitLabel="저장"
        />
      </div>
    </div>
  )
}
