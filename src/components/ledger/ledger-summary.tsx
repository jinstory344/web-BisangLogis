import { ChevronRight } from "lucide-react"
import Link from "next/link"

import { TotalsRow } from "@/components/list/totals-row"
import { formatKRW } from "@/lib/money"
import type { LedgerTotals } from "@/lib/ledger"

import { EXPENSE_TEXT_CLASS, INCOME_TEXT_CLASS, profitTextClass } from "./colors"

/**
 * 비상 상단 요약 줄: 매출(공급가액) / 지출 / 수익(매출 − 지출, 굵게). 검색 화면과 같은 모양.
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
        { label: "수익", value: formatKRW(totals.net), className: profitTextClass(totals.net) },
      ]}
      size="lg"
    />
  )
}

/**
 * 미입금 한 줄: HOME에서 보고 있는 기간(일일·달력·주별은 그 달, 월별은 그 해, 연별은 전체)의 미입금 매출.
 * 누르면 같은 기간의 매출 목록을 미입금만 걸러서 연다. 미입금이 없으면 보이지 않는다.
 */
export function UnpaidLine({
  unpaid,
  range,
}: {
  unpaid: { count: number; supplyAmount: number }
  range: { from: string; to: string }
}) {
  if (unpaid.count === 0) return null
  return (
    <Link
      href={`/sales?from=${range.from}&to=${range.to}&payment_status=UNPAID`}
      className="-mx-4 flex items-center justify-between gap-3 border-b px-4 py-2 text-[13px] transition-colors hover:bg-muted/40 active:bg-muted/60 md:mx-0 md:px-0"
    >
      <span className="text-muted-foreground">미입금 {unpaid.count}건</span>
      <span className="flex items-center gap-0.5 text-[13px] text-foreground/85 tabular-nums">
        {formatKRW(unpaid.supplyAmount)}
        <ChevronRight className="size-4 text-muted-foreground" />
      </span>
    </Link>
  )
}
