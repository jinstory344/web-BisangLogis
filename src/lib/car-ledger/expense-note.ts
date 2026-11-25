import { formatLiters } from "@/lib/fuel"

import { formatKm, isCarServiceCategory, isCarTrackedCategory } from "./constants"

interface NoteExpense {
  category_major: string
  category_minor: string
  liters: number | null
  odometer_km: number | null
  vendor: string | null
  memo: string | null
}

/**
 * 지출 목록·장부 둘째 줄(사용처·비고): 정비면 항목 이름을 앞에, km는 정비·주유비·요소수 줄에.
 * 예: "엔진오일 · 배터리 · 615,848km · 환영모터스"
 */
export function expenseNoteLine(row: NoteExpense, serviceItemNames: readonly string[] = []): string {
  const isService = isCarServiceCategory(row.category_major, row.category_minor)
  const isTracked = isCarTrackedCategory(row.category_major, row.category_minor)
  return [
    ...(isService ? serviceItemNames : []),
    row.liters !== null ? formatLiters(row.liters) : null,
    isTracked && row.odometer_km !== null ? formatKm(row.odometer_km) : null,
    row.vendor,
    row.memo,
  ]
    .map((text) => text?.trim())
    .filter(Boolean)
    .join(" · ")
}
