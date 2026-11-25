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
  /** 달 고르기 창에서 해를 눌러 1년치 보기 (차계부) — 1년치일 때 화살표는 해 단위로 */
  allowYear?: boolean
}

/**
 * 모바일 목록 상단의 `‹ 2026년 11월 ›` 달 이동.
 * 기간이 정확히 한 달이 아니면(직접 지정) "11/1 ~ 11/20"처럼 보여 주고,
 * 화살표는 시작일이 속한 달을 기준으로 이전·다음 달로 옮긴다.
 */
export function MonthNavigator({ from, to, hrefForRange, allowYear = false }: MonthNavigatorProps) {
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

  const yearRange = (year: number): DateRange => ({ from: `${year}-01-01`, to: `${year}-12-31` })
  const yearMode = allowYear && isFullYear
  const shift = (delta: number): DateRange =>
    yearMode ? yearRange(Number(from.slice(0, 4)) + delta) : shiftMonthRange(from, delta)

  // 전체 기간은 넘길 이전·다음 달이 없으므로 화살표 대신 같은 너비의 빈칸
  const arrowSpacer = <span aria-hidden className="size-10" />

  return (
    <div className="flex items-center justify-between">
      {allPeriod ? arrowSpacer : (
      <Link
        href={hrefForRange(shift(-1))}
        // 이웃 달을 미리 받아 두어 화살표·스와이프로 넘길 때 바로 뜨게 한다.
        prefetch
        aria-label={yearMode ? "이전 해" : "이전 달"}
        className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <ChevronLeft className="size-5" />
      </Link>
      )}
      <div className="flex items-baseline gap-2">
        {isMonth || yearMode ? (
          <PeriodPicker
            mode="month"
            value={from}
            label={label}
            hrefFor={(date) => hrefForRange(getMonthRange(date))}
            yearHref={allowYear ? (year) => hrefForRange(yearRange(year)) : undefined}
          />
        ) : (
          <span className="text-lg font-semibold">{label}</span>
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
        href={hrefForRange(shift(1))}
        prefetch
        aria-label={yearMode ? "다음 해" : "다음 달"}
        className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <ChevronRight className="size-5" />
      </Link>
      )}
    </div>
  )
}
