import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

import { formatYearMonth, getTodayInSeoul, shiftMonthRange } from "@/lib/date"
import type { LedgerView } from "@/lib/ledger"

/**
 * 장부 상단 기간 이동. 일일·주별은 `‹ 2026년 11월 ›`(달 단위), 월별은 `‹ 2026년 ›`(해 단위),
 * 연별은 전체라서 이동 없이 "전체"만 보여 준다.
 */
export function LedgerNav({ view, anchor }: { view: LedgerView; anchor: string }) {
  if (view === "year") {
    return (
      <div className="flex min-h-11 items-center justify-center">
        <span className="text-lg font-semibold">전체</span>
      </div>
    )
  }

  const today = getTodayInSeoul()
  const year = Number(anchor.slice(0, 4))
  const isYearView = view === "month"

  const prevAnchor = isYearView
    ? `${year - 1}-01-01`
    : shiftMonthRange(anchor, -1).from
  const nextAnchor = isYearView
    ? `${year + 1}-01-01`
    : shiftMonthRange(anchor, 1).from
  const label = isYearView ? `${year}년` : formatYearMonth(anchor)

  const isCurrent = isYearView
    ? anchor.slice(0, 4) === today.slice(0, 4)
    : anchor.slice(0, 7) === today.slice(0, 7)
  const currentLabel = isYearView ? "올해로" : "이번 달로"

  const href = (d: string) => `/?view=${view}&d=${d}`

  return (
    <div className="flex items-center justify-between">
      <Link
        href={href(prevAnchor)}
        aria-label={isYearView ? "이전 해" : "이전 달"}
        className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <ChevronLeft className="size-5" />
      </Link>
      <div className="flex flex-col items-center">
        <span className="text-lg font-semibold">{label}</span>
        {isCurrent ? null : (
          <Link
            href={href(today)}
            className="text-xs text-muted-foreground underline underline-offset-2"
          >
            {currentLabel}
          </Link>
        )}
      </div>
      <Link
        href={href(nextAnchor)}
        aria-label={isYearView ? "다음 해" : "다음 달"}
        className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <ChevronRight className="size-5" />
      </Link>
    </div>
  )
}
