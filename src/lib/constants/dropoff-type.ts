import type { DropoffType } from "@/lib/supabase/database.types"

export const DROPOFF_TYPE_LABELS: Record<DropoffType, string> = {
  SAME_DAY: "당착",
  NEXT_DAY: "익착",
}

export const DROPOFF_TYPE_OPTIONS = (
  Object.entries(DROPOFF_TYPE_LABELS) as [DropoffType, string][]
).map(([value, label]) => ({ value, label }))
