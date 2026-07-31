import { Badge } from "@/components/ui/badge"
import type { PaymentStatus } from "@/lib/supabase/database.types"

/** 4.4 UI 표시 규칙: 미입금 빨간색 배지 / 입금완료 회색 배지 */
export function PaymentBadge({ status }: { status: PaymentStatus }) {
  if (status === "PAID") {
    return <Badge variant="secondary">입금완료</Badge>
  }

  return <Badge variant="destructive">미입금</Badge>
}
