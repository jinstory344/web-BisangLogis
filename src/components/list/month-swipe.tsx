"use client"

import { usePathname, useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

import { SwipePager } from "@/components/ledger/swipe-pager"
import { getCurrentMonthRangeInSeoul, shiftMonthRange } from "@/lib/date"

/**
 * 매출·지출·배차 목록과 통계 화면의 좌우 스와이프: 지금 주소의 from(없으면 이번 달)을 기준으로
 * 이전/다음 달 주소를 만들어(다른 필터는 유지, page는 지움) SwipePager로 넘긴다.
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
  const from = searchParams.get("from") || getCurrentMonthRangeInSeoul().from

  function hrefFor(months: number) {
    const range = shiftMonthRange(from, months)
    const params = new URLSearchParams(searchParams.toString())
    params.set("from", range.from)
    params.set("to", range.to)
    params.delete("page")
    return `${pathname}?${params.toString()}`
  }

  return (
    <SwipePager prevHref={hrefFor(-1)} nextHref={hrefFor(1)} className={className}>
      {children}
    </SwipePager>
  )
}
