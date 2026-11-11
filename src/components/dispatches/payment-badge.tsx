import { Badge } from "@/components/ui/badge"
import type { PaymentStatus } from "@/lib/supabase/database.types"

/** 입금완료를 나타내는 파란색 계열 글자색 (밝은 배경/어두운 배경 모두 읽히도록) */
export const PAID_TEXT_CLASS = "text-blue-600 dark:text-blue-400"

/** UI 표시 규칙: 미입금 빨간색 배지 / 입금완료 파란색 배지 */
export function PaymentBadge({ status }: { status: PaymentStatus }) {
  if (status === "PAID") {
    return (
      <Badge
        variant="secondary"
        className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      >
        입금완료
      </Badge>
    )
  }

  return <Badge variant="destructive">미입금</Badge>
}
