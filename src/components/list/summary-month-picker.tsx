"use client"

import { usePathname, useSearchParams } from "next/navigation"

import { PeriodPicker } from "@/components/list/period-picker"
import {
  formatYearMonth,
  getMonthRange,
  getTodayInSeoul,
  isAllPeriod,
  isFullMonthRange,
  type DateRange,
} from "@/lib/date"

/**
 * 목록 화면(배차·매출·지출) 머리 오른쪽 끝의 달력 아이콘. 누르면 1~12월 고르기 창.
 * 아이콘 안에 보고 있는 달 숫자를 넣는다(직접 지정한 기간·전체 기간이면 숫자 없이).
 * 이전·다음 달은 목록을 좌우로 쓸어 넘긴다. 다른 필터는 그대로 두고 page만 지운다.
 */
export function SummaryMonthPicker({ from, to }: DateRange) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const allPeriod = isAllPeriod({ from, to })
  const isMonth = isFullMonthRange({ from, to })
  const value = allPeriod ? getTodayInSeoul() : from

  function hrefFor(date: string) {
    const range = getMonthRange(date)
    const params = new URLSearchParams(searchParams.toString())
    params.set("from", range.from)
    params.set("to", range.to)
    params.delete("page")
    return `${pathname}?${params.toString()}`
  }

  return (
    <PeriodPicker
      mode="month"
      value={value}
      label={allPeriod ? "전체 기간" : formatYearMonth(value)}
      hrefFor={hrefFor}
      iconText={isMonth ? String(Number(from.slice(5, 7))) : ""}
    />
  )
}
