import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

import { formatYearMonth, getTodayInSeoul } from "@/lib/date"
import {
  getLedgerNeighborAnchors,
  ledgerHref,
  type LedgerKindFilter,
  type LedgerView,
} from "@/lib/ledger"

import { LedgerPeriodPicker } from "./ledger-period-picker"

/**
 * 장부 상단 기간 이동. 일일·주별은 `‹ 2026년 11월 ›`(달 단위), 월별은 `‹ 2026년 ›`(해 단위),
 * 연별은 전체라서 이동 없이 "전체"만 보여 준다.
 */
export function LedgerNav({
  view,
  anchor,
  kind = "all",
}: {
  view: LedgerView
  anchor: string
  kind?: LedgerKindFilter
}) {
  const neighbors = getLedgerNeighborAnchors(view, anchor)
  if (view === "year" || !neighbors) {
    return (
      <div className="flex min-h-10 items-center justify-center">
        <span className="text-base font-semibold">전체</span>
      </div>
    )
  }

  const today = getTodayInSeoul()
  const year = Number(anchor.slice(0, 4))
  const isYearView = view === "month"

  const label = isYearView ? `${year}년` : formatYearMonth(anchor)

  const isCurrent = isYearView
    ? anchor.slice(0, 4) === today.slice(0, 4)
    : anchor.slice(0, 7) === today.slice(0, 7)
  const currentLabel = isYearView ? "올해로" : "이번 달로"

  const href = (d: string) => ledgerHref(view, d, kind)

  return (
    <div className="flex items-center justify-between">
      <Link
        href={href(neighbors.prev)}
        // 이웃 달을 미리 다 받아 두어 스와이프·화살표로 넘길 때 바로 뜨게 한다.
        prefetch
        aria-label={isYearView ? "이전 해" : "이전 달"}
        className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <ChevronLeft className="size-5" />
      </Link>
      <div className="flex items-baseline gap-2">
        <LedgerPeriodPicker view={view} anchor={anchor} kind={kind} label={label} />
        {isCurrent ? null : (
          <Link
            href={href(today)}
            className="text-[11px] text-muted-foreground underline underline-offset-2"
          >
            {currentLabel}
          </Link>
        )}
      </div>
      <Link
        href={href(neighbors.next)}
        prefetch
        aria-label={isYearView ? "다음 해" : "다음 달"}
        className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <ChevronRight className="size-5" />
      </Link>
    </div>
  )
}
