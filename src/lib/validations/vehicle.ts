import { z } from "zod"

export const vehicleFormSchema = z.object({
  plate_no: z.string().trim().min(1, "차량번호를 입력하세요"),
  driver_name: z.string().trim().min(1, "기사명을 입력하세요"),
  driver_phone: z.string().trim(),
  carrier_name: z.string().trim(),
  vehicle_type: z.string().trim(),
  memo: z.string().trim(),
})

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>

export const vehicleFormDefaults: VehicleFormValues = {
  plate_no: "",
  driver_name: "",
  driver_phone: "",
  carrier_name: "",
  vehicle_type: "",
  memo: "",
}
