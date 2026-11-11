"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

import {
  formatMonthDay,
  formatYearMonth,
  getCurrentMonthRangeInSeoul,
  isFullMonthRange,
  shiftMonthRange,
  type DateRange,
} from "@/lib/date"

interface MonthNavigatorProps {
  from: string
  to: string
  /** 기간을 바꿨을 때 이동할 주소 (다른 필터는 유지하고 page는 지우는 쪽은 호출하는 화면이 정한다) */
  hrefForRange: (range: DateRange) => string
}

/**
 * 모바일 목록 상단의 `‹ 2026년 11월 ›` 달 이동.
 * 기간이 정확히 한 달이 아니면(직접 지정) "11/1 ~ 11/20"처럼 보여 주고,
 * 화살표는 시작일이 속한 달을 기준으로 이전·다음 달로 옮긴다.
 */
export function MonthNavigator({ from, to, hrefForRange }: MonthNavigatorProps) {
  const isMonth = isFullMonthRange({ from, to })
  const currentMonth = getCurrentMonthRangeInSeoul()
  const isCurrentMonth = from === currentMonth.from && to === currentMonth.to
  const label = isMonth
    ? formatYearMonth(from)
    : `${formatMonthDay(from)} ~ ${formatMonthDay(to)}`

  return (
    <div className="flex items-center justify-between">
      <Link
        href={hrefForRange(shiftMonthRange(from, -1))}
        aria-label="이전 달"
        className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <ChevronLeft className="size-5" />
      </Link>
      <div className="flex flex-col items-center">
        <span className="text-lg font-semibold">{label}</span>
        {isCurrentMonth ? null : (
          <Link
            href={hrefForRange(currentMonth)}
            className="text-xs text-muted-foreground underline underline-offset-2"
          >
            이번 달로
          </Link>
        )}
      </div>
      <Link
        href={hrefForRange(shiftMonthRange(from, 1))}
        aria-label="다음 달"
        className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <ChevronRight className="size-5" />
      </Link>
    </div>
  )
}
