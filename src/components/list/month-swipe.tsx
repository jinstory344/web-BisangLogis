"use client"

import { usePathname, useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

import { SwipePager } from "@/components/ledger/swipe-pager"
import { getCurrentMonthRangeInSeoul, isAllPeriod, shiftMonthRange } from "@/lib/date"
import { listAnchor, parseListView, viewNeighborHrefs } from "@/lib/period-view"

/**
 * 매출·지출·배차·차계부 목록과 통계 화면의 좌우 스와이프: 지금 주소의 from(없으면 이번 달)을 기준으로
 * 이전/다음 달 주소를 만들어(다른 필터는 유지, page는 지움) SwipePager로 넘긴다.
 * 보기(view)가 있으면 HOME과 같게 보기 단위로 넘긴다(달력·주별 = 달, 월별 = 해, 연별 = 없음).
 */
export function MonthSwipe({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentFrom = getCurrentMonthRangeInSeoul().from
  const from = searchParams.get("from") || currentFrom
  const to = searchParams.get("to") ?? ""
  const view = parseListView(searchParams.get("view") ?? undefined)

  if (view !== "day") {
    const neighbors = viewNeighborHrefs(
      pathname,
      Object.fromEntries(searchParams.entries()),
      view,
      listAnchor(from, to, currentFrom)
    )
    return (
      <SwipePager prevHref={neighbors?.prev ?? null} nextHref={neighbors?.next ?? null} className={className}>
        {children}
      </SwipePager>
    )
  }

  // 전체 기간(미입금 전체 보기 등)은 넘길 달이 없다
  const allPeriod = isAllPeriod({ from, to })

  function hrefFor(months: number) {
    const range = shiftMonthRange(from, months)
    const params = new URLSearchParams(searchParams.toString())
    params.set("from", range.from)
    params.set("to", range.to)
    params.delete("page")
    return `${pathname}?${params.toString()}`
  }

  return (
    <SwipePager
      prevHref={allPeriod ? null : hrefFor(-1)}
      nextHref={allPeriod ? null : hrefFor(1)}
      className={className}
    >
      {children}
    </SwipePager>
  )
}
