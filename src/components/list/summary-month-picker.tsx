"use client"

import { usePathname, useSearchParams } from "next/navigation"

import { PeriodPicker } from "@/components/list/period-picker"
import {
  formatYearMonth,
  getCurrentMonthRangeInSeoul,
  getMonthRange,
  getTodayInSeoul,
  isAllPeriod,
  isFullMonthRange,
  type DateRange,
} from "@/lib/date"
import { listAnchor, parseListView, viewAnchorHref, viewPickerSpec } from "@/lib/period-view"

/**
 * 목록 화면(배차·매출·지출·차계부·통계) 머리 오른쪽 끝의 달력 아이콘. 누르면 1~12월 고르기 창.
 * 아이콘 안에 보고 있는 달 숫자를 넣는다(직접 지정한 기간·전체 기간이면 숫자 없이).
 * 보기(view)가 있으면 HOME과 같게: 달력·주별 = 달 고르기, 월별 = 해 고르기(아이콘 안 "26"), 연별 = 없음.
 * 이전·다음 달은 목록을 좌우로 쓸어 넘긴다. 다른 필터는 그대로 두고 page만 지운다.
 */
export function SummaryMonthPicker({ from, to }: DateRange) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view = parseListView(searchParams.get("view") ?? undefined)

  if (view !== "day") {
    const anchor = listAnchor(from, to, getCurrentMonthRangeInSeoul().from)
    const spec = viewPickerSpec(view, anchor)
    if (!spec) return <span aria-hidden />
    const params = Object.fromEntries(searchParams.entries())
    return (
      <PeriodPicker
        mode={spec.mode}
        value={anchor}
        label={spec.label}
        hrefFor={(date) => viewAnchorHref(pathname, params, view, date)}
        iconText={spec.iconText}
      />
    )
  }

  return <DayMonthPicker from={from} to={to} pathname={pathname} searchParams={searchParams} />
}

function DayMonthPicker({
  from,
  to,
  pathname,
  searchParams,
}: DateRange & { pathname: string; searchParams: { toString(): string } }) {
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
