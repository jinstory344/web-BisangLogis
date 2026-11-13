import { ChevronRight } from "lucide-react"
import Link from "next/link"

import { TotalsRow } from "@/components/list/totals-row"
import { formatKRW } from "@/lib/money"
import type { LedgerTotals } from "@/lib/ledger"

import { EXPENSE_TEXT_CLASS, INCOME_TEXT_CLASS, netTextClass } from "./colors"

/**
 * 비상 상단 합계 줄: 매출(공급가액) / 지출 / 합계(매출 − 지출). 검색 화면과 같은 모양.
 */
export function LedgerSummary({ totals }: { totals: LedgerTotals }) {
  return (
    <TotalsRow
      items={[
        {
          label: "매출",
          value: formatKRW(totals.income),
          className: INCOME_TEXT_CLASS,
        },
        {
          label: "지출",
          value: formatKRW(totals.expense),
          className: EXPENSE_TEXT_CLASS,
        },
        { label: "합계", value: formatKRW(totals.net), className: netTextClass(totals.net) },
      ]}
    />
  )
}

/**
 * 미입금 한 줄: 기간과 상관없이 아직 입금되지 않은 매출 전체.
 * 누르면 매출 목록의 미입금 보기로 간다. 미입금이 없으면 보이지 않는다.
 */
export function UnpaidLine({ unpaid }: { unpaid: { count: number; supplyAmount: number } }) {
  if (unpaid.count === 0) return null
  return (
    <Link
      href="/sales?from=1970-01-01&to=2099-12-31&payment_status=UNPAID"
      className="-mx-4 flex items-center justify-between gap-3 border-b px-4 py-2 text-xs transition-colors hover:bg-muted/40 active:bg-muted/60 md:mx-0 md:px-0"
    >
      <span className="text-muted-foreground">미입금 {unpaid.count}건</span>
      <span className="flex items-center gap-0.5 text-sm font-medium tabular-nums">
        {formatKRW(unpaid.supplyAmount)}
        <ChevronRight className="size-4 text-muted-foreground" />
      </span>
    </Link>
  )
}
