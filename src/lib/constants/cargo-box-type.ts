import type { CargoBoxType } from "@/lib/supabase/database.types"

export const CARGO_BOX_TYPE_LABELS: Record<CargoBoxType, string> = {
  REFRIGERATED: "냉동탑",
  WING: "냉장윙",
  BOX: "탑",
  CARGO: "카고",
  OTHER: "기타",
}

export const CARGO_BOX_TYPE_OPTIONS = (
  Object.entries(CARGO_BOX_TYPE_LABELS) as [CargoBoxType, string][]
).map(([value, label]) => ({ value, label }))
