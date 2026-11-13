"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

import {
  formatMonthDay,
  formatYearMonth,
  getCurrentMonthRangeInSeoul,
  getMonthRange,
  isAllPeriod,
  isFullMonthRange,
  shiftMonthRange,
  type DateRange,
} from "@/lib/date"

import { PeriodPicker } from "./period-picker"

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
  const allPeriod = isAllPeriod({ from, to })
  // 한 해 전체(HOME 월별 보기의 미입금 줄에서 들어옴)는 "2026년"으로
  const isFullYear =
    from.slice(5) === "01-01" && to === `${from.slice(0, 4)}-12-31`
  const label = allPeriod
    ? "전체 기간"
    : isFullYear
      ? `${from.slice(0, 4)}년`
      : isMonth
      ? formatYearMonth(from)
      : `${formatMonthDay(from)} ~ ${formatMonthDay(to)}`

  // 전체 기간은 넘길 이전·다음 달이 없으므로 화살표 대신 같은 너비의 빈칸
  const arrowSpacer = <span aria-hidden className="size-10" />

  return (
    <div className="flex items-center justify-between">
      {allPeriod ? arrowSpacer : (
      <Link
        href={hrefForRange(shiftMonthRange(from, -1))}
        // 이웃 달을 미리 받아 두어 화살표·스와이프로 넘길 때 바로 뜨게 한다.
        prefetch
        aria-label="이전 달"
        className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <ChevronLeft className="size-5" />
      </Link>
      )}
      <div className="flex items-baseline gap-2">
        {isMonth ? (
          <PeriodPicker
            mode="month"
            value={from}
            label={label}
            hrefFor={(date) => hrefForRange(getMonthRange(date))}
          />
        ) : (
          <span className="text-base font-semibold">{label}</span>
        )}
        {isCurrentMonth ? null : (
          <Link
            href={hrefForRange(currentMonth)}
            className="text-[11px] text-muted-foreground underline underline-offset-2"
          >
            이번 달로
          </Link>
        )}
      </div>
      {allPeriod ? arrowSpacer : (
      <Link
        href={hrefForRange(shiftMonthRange(from, 1))}
        prefetch
        aria-label="다음 달"
        className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <ChevronRight className="size-5" />
      </Link>
      )}
    </div>
  )
}
