import { Badge } from "@/components/ui/badge"
import {
  formatTaxInfoStatus,
  type TaxInfoStatus,
} from "@/lib/client-tax-info"
import { cn } from "@/lib/utils"

/**
 * 거래처의 세금계산서 정보가 얼마나 채워졌는지 보여 주는 작은 표시.
 * 매출은 이 정보 없이도 저장되므로 경고가 아니라 "나중에 채울 곳" 안내 톤으로 보여 준다.
 */
export function TaxInfoBadge({
  status,
  className,
}: {
  status: TaxInfoStatus
  className?: string
}) {
  return (
    <Badge
      variant={status.level === "complete" ? "secondary" : "outline"}
      className={cn(
        status.level === "partial" &&
          "border-amber-300 text-amber-700 dark:border-amber-500/50 dark:text-amber-400",
        status.level === "empty" && "text-muted-foreground",
        className
      )}
    >
      {formatTaxInfoStatus(status)}
    </Badge>
  )
}
