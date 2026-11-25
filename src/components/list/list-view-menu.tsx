"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"

import { getCurrentMonthRangeInSeoul } from "@/lib/date"
import { LEDGER_VIEWS } from "@/lib/ledger"
import { listAnchor, parseListView, viewAnchorHref } from "@/lib/period-view"
import { cn } from "@/lib/utils"

/**
 * 매출·지출·배차·차계부 머리 아래의 보기 탭 줄: 일일 · 달력 · 주별 · 월별 · 연별 (HOME 보기 탭과 같은 모양 — 사용자 요청).
 * 거르기 값은 그대로, 보고 있는 달(기준일)도 그대로 가지고 간다.
 */
export function ListViewTabs() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view = parseListView(searchParams.get("view") ?? undefined)
  const currentFrom = getCurrentMonthRangeInSeoul().from
  const anchor = listAnchor(searchParams.get("from") ?? "", searchParams.get("to") ?? "", currentFrom)
  const params = Object.fromEntries(searchParams.entries())
  const activeRef = useRef<HTMLAnchorElement>(null)

  // 고른 탭을 가운데로 (가로로만 움직여서 페이지가 위아래로 튀지 않게)
  useEffect(() => {
    const active = activeRef.current
    const nav = active?.parentElement
    if (!active || !nav) return
    nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.clientWidth) / 2
  }, [view])

  return (
    <nav
      aria-label="보기"
      // 이 줄 안에서 좌우로 미는 건 탭 스크롤이지 달 넘기기가 아니다
      data-swipe-ignore
      className="no-scrollbar -mx-4 grid auto-cols-[minmax(4rem,1fr)] grid-flow-col overflow-x-auto border-b px-2"
    >
      {LEDGER_VIEWS.map((item) => {
        const isActive = item.value === view
        return (
          <Link
            key={item.value}
            ref={isActive ? activeRef : undefined}
            href={viewAnchorHref(pathname, params, item.value, anchor)}
            prefetch
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex min-h-9 items-center justify-center px-3 text-sm whitespace-nowrap transition-colors",
              isActive ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
            {isActive ? (
              <span aria-hidden className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-red-400" />
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
