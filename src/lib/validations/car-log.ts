import { z } from "zod"

import { parseKm } from "@/lib/car-ledger/constants"
import { parseLiters } from "@/lib/fuel"
import { amountSchema } from "@/lib/money"
import type { CarLogRow } from "@/lib/supabase/database.types"

import { parseServiceItemsJson, serviceItemsSchema, type ServiceItemValue } from "./expense"

/**
 * 차계부 기록(car_logs) 폼 검증. 지출 폼과 같은 규칙:
 * 금액은 순수 z.number(), 리터·km는 글자로 두고 서버에서 숫자로 바꾼다(zod coerce 금지).
 */
export const carLogFormSchema = z.object({
  car_id: z.string().min(1, "차를 고르세요"),
  log_date: z.string().min(1, "날짜를 입력하세요"),
  kind: z.string().trim().min(1, "종류를 고르세요").max(20, "종류 이름은 20자 이하예요"),
  amount: amountSchema,
  liters: z
    .string()
    .refine((v) => !Number.isNaN(parseLiters(v)), "리터는 숫자로 입력하세요 (예: 45 또는 38.5)"),
  odometer_km: z
    .string()
    .refine((v) => !Number.isNaN(parseKm(v)), "km는 숫자로 입력하세요 (예: 85,200)"),
  vendor: z.string().trim().max(50, "장소는 50자 이하로 입력하세요"),
  memo: z.string().trim().max(1000, "비고는 1000자 이하로 입력하세요"),
  service_items: serviceItemsSchema,
})

export type CarLogFormValues = z.infer<typeof carLogFormSchema>

export function carLogFormDefaults(carId: string, kind: string, today: string): CarLogFormValues {
  return {
    car_id: carId,
    log_date: today,
    kind,
    amount: 0,
    liters: "",
    odometer_km: "",
    vendor: "",
    memo: "",
    service_items: [],
  }
}

/** 저장된 기록 → 폼 값 (수정 화면) */
export function carLogRowToFormValues(
  row: CarLogRow,
  serviceItems: readonly ServiceItemValue[]
): CarLogFormValues {
  return {
    car_id: row.car_id,
    log_date: row.log_date,
    kind: row.kind,
    amount: Number(row.amount),
    liters: row.liters !== null ? String(row.liters) : "",
    odometer_km: row.odometer_km !== null ? String(row.odometer_km) : "",
    vendor: row.vendor ?? "",
    memo: row.memo ?? "",
    service_items: serviceItems.map((line) => ({ item: line.item, amount: line.amount })),
  }
}

/** 폼 값 → FormData (정비 항목 줄은 JSON 글자) */
export function buildCarLogFormData(values: CarLogFormValues): FormData {
  const fd = new FormData()
  Object.entries(values).forEach(([key, value]) => {
    fd.set(key, key === "service_items" ? JSON.stringify(value) : String(value))
  })
  return fd
}

/** FormData(글자) → 검증 직전 값 */
export function coerceCarLogFormData(raw: Record<string, FormDataEntryValue>): Record<string, unknown> {
  return {
    ...raw,
    amount: Number(raw.amount),
    liters: raw.liters ?? "",
    odometer_km: raw.odometer_km ?? "",
    vendor: raw.vendor ?? "",
    memo: raw.memo ?? "",
    service_items: parseServiceItemsJson(raw.service_items),
  }
}
