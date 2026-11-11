import Link from "next/link"

import { formatKRW } from "@/lib/money"
import type { LedgerTotals } from "@/lib/ledger"
import { cn } from "@/lib/utils"

import { EXPENSE_TEXT_CLASS, INCOME_TEXT_CLASS, netTextClass } from "./colors"

/**
 * 장부 상단 요약: 매출(공급가액) / 지출 / 합계(남은 돈) + 미수금.
 * 미수금은 기간과 상관없이 아직 입금되지 않은 매출 전체이고, 누르면 매출 목록의 미입금 보기로 간다.
 */
export function LedgerSummary({
  totals,
  unpaid,
}: {
  totals: LedgerTotals
  unpaid: { count: number; supplyAmount: number }
}) {
  return (
    <div className="rounded-xl border p-3">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-xs text-muted-foreground">매출</p>
          <p
            className={cn(
              "text-base font-semibold tabular-nums",
              INCOME_TEXT_CLASS
            )}
          >
            {formatKRW(totals.income)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">지출</p>
          <p
            className={cn(
              "text-base font-semibold tabular-nums",
              EXPENSE_TEXT_CLASS
            )}
          >
            {formatKRW(totals.expense)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">합계</p>
          <p
            className={cn(
              "text-base font-semibold tabular-nums",
              netTextClass(totals.net)
            )}
          >
            {formatKRW(totals.net)}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        매출은 공급가액 기준 · 합계 = 매출 − 지출
      </p>
      {unpaid.count > 0 ? (
        <Link
          href="/sales?from=1970-01-01&to=2099-12-31&payment_status=UNPAID"
          className="mt-2 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
        >
          <span className="text-muted-foreground">
            받을 돈 (미입금 {unpaid.count}건)
          </span>
          <span className="font-semibold tabular-nums">
            {formatKRW(unpaid.supplyAmount)}
          </span>
        </Link>
      ) : null}
    </div>
  )
}
