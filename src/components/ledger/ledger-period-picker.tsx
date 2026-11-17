"use client"

import { PeriodPicker } from "@/components/list/period-picker"
import { ledgerHref, type LedgerKindFilter, type LedgerView } from "@/lib/ledger"

/** 장부(HOME) 가운데 "2026년 11월"/"2026년"을 눌러 달·해를 바로 고른다. */
export function LedgerPeriodPicker({
  view,
  anchor,
  kind,
  label,
  iconText,
}: {
  view: LedgerView
  anchor: string
  kind: LedgerKindFilter
  label: string
  /** 있으면 머리 오른쪽 달력 아이콘으로 (아이콘 안 글자: 달 "11" / 월별 보기는 해 "26") */
  iconText?: string
}) {
  return (
    <PeriodPicker
      mode={view === "month" ? "year" : "month"}
      value={anchor}
      label={label}
      hrefFor={(date) => ledgerHref(view, date, kind)}
      iconText={iconText}
    />
  )
}
