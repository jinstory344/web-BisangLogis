"use client"

import { PeriodPicker } from "@/components/list/period-picker"
import { ledgerHref, type LedgerKindFilter, type LedgerView } from "@/lib/ledger"

/** 장부(HOME) 가운데 "2026년 11월"/"2026년"을 눌러 달·해를 바로 고른다. */
export function LedgerPeriodPicker({
  view,
  anchor,
  kind,
  label,
}: {
  view: LedgerView
  anchor: string
  kind: LedgerKindFilter
  label: string
}) {
  return (
    <PeriodPicker
      mode={view === "month" ? "year" : "month"}
      value={anchor}
      label={label}
      hrefFor={(date) => ledgerHref(view, date, kind)}
    />
  )
}
