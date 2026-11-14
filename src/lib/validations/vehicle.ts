import { z } from "zod"

export const vehicleFormSchema = z.object({
  plate_no: z.string().trim().min(1, "차량번호를 입력하세요"),
  driver_name: z.string().trim().min(1, "차주 이름을 입력하세요"),
  driver_phone: z.string().trim(),
  vehicle_type: z.string().trim(),
  /** 파렛수 — 폼에서는 "" 또는 "3" 같은 글자, 서버에서 숫자(또는 null)로 바꾼다 */
  pallet_count: z.string().trim().regex(/^\d{0,2}$/, "파렛수를 다시 골라 주세요"),
  memo: z.string().trim(),
})

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>

export const vehicleFormDefaults: VehicleFormValues = {
  plate_no: "",
  driver_name: "",
  driver_phone: "",
  vehicle_type: "",
  pallet_count: "",
  memo: "",
}

/** 차종 선택지 (vehicle_type에 글자 그대로 저장) */
export const VEHICLE_BODY_TYPES = ["냉동탑", "냉장윙", "윙바디", "탑", "카고", "호루"] as const

/** 파렛수 선택지 2p~18p */
export const PALLET_COUNT_OPTIONS = Array.from({ length: 17 }, (_, i) => i + 2)

/** 폼 값 → DB 값: 빈 글자는 null, 파렛수는 숫자로 */
export function toVehicleDbValues(values: VehicleFormValues) {
  const blank = (v: string) => (v.trim() === "" ? null : v.trim())
  return {
    plate_no: values.plate_no,
    driver_name: values.driver_name,
    driver_phone: blank(values.driver_phone),
    vehicle_type: blank(values.vehicle_type),
    pallet_count: values.pallet_count ? Number(values.pallet_count) : null,
    memo: blank(values.memo),
  }
}

/** 목록·메뉴에 붙이는 짧은 표시: "냉동탑 · 3p" */
export function vehicleSpecLabel(v: { vehicle_type: string | null; pallet_count: number | null }): string {
  return [v.vehicle_type, v.pallet_count ? `${v.pallet_count}p` : null].filter(Boolean).join(" · ")
}
