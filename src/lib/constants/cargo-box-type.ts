import type { CargoBoxType } from "@/lib/supabase/database.types"

export const CARGO_BOX_TYPE_LABELS: Record<CargoBoxType, string> = {
  CARGO: "카고",
  BOX: "탑차",
  WING: "윙바디",
  REFRIGERATED: "냉동",
  OTHER: "기타",
}

export const CARGO_BOX_TYPE_OPTIONS = (
  Object.entries(CARGO_BOX_TYPE_LABELS) as [CargoBoxType, string][]
).map(([value, label]) => ({ value, label }))
