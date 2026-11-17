import { TotalsRow } from "@/components/list/totals-row"
import { formatKRW } from "@/lib/money"
import type { LedgerTotals } from "@/lib/ledger"

import { EXPENSE_TEXT_CLASS, INCOME_TEXT_CLASS, profitTextClass } from "./colors"

/**
 * 비상 상단 요약 줄: 매출(공급가액) / 지출 / 수익(매출 − 지출, 굵게). 금액은 16px (18px은 HOME에서 너무 커 보여서).
 */
export function LedgerSummary({ totals }: { totals: LedgerTotals }) {
  return (
    <TotalsRow
      items={[
        {
          label: "매출",
          value: formatKRW(totals.income),
          className: `${INCOME_TEXT_CLASS} text-base`,
        },
        {
          label: "지출",
          value: formatKRW(totals.expense),
          className: `${EXPENSE_TEXT_CLASS} text-base`,
        },
        { label: "수익", value: formatKRW(totals.net), className: `${profitTextClass(totals.net)} text-base` },
      ]}
      size="lg"
    />
  )
}
