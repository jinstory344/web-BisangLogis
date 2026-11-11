"use client"

import { usePathname, useSearchParams } from "next/navigation"

import { MonthNavigator } from "@/components/list/month-navigator"
import type { DateRange } from "@/lib/date"

/**
 * 월간 집계 탭 상단의 `‹ 2026년 11월 ›` 달 이동.
 * 목록 탭과 같은 주소(from·to)를 바꾸므로 두 탭이 같은 달을 보여 준다. 다른 필터는 그대로 두고 page만 지운다.
 */
export function SummaryMonthNav({ from, to }: DateRange) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function hrefForRange(range: DateRange) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("from", range.from)
    params.set("to", range.to)
    params.delete("page")
    return `${pathname}?${params.toString()}`
  }

  return <MonthNavigator from={from} to={to} hrefForRange={hrefForRange} />
}
