"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"

import { LEDGER_VIEWS, type LedgerView } from "@/lib/ledger"
import { cn } from "@/lib/utils"

/**
 * 비상 보기 전환: 일일 / 주별 / 월별 / 연별 (가계부 앱처럼 글자 + 빨간 밑줄).
 * 메뉴가 늘어나 화면을 넘치면 좌우로 밀어 볼 수 있고, 고른 메뉴는 보이는 자리로 스크롤된다.
 * 보고 있던 달(기준일)은 그대로 가지고 간다.
 */
export function LedgerViewTabs({
  view,
  anchor,
}: {
  view: LedgerView
  anchor: string
}) {
  const activeRef = useRef<HTMLAnchorElement>(null)

  // 고른 메뉴를 가운데로 (가로로만 움직여서 페이지가 위아래로 튀지 않게)
  useEffect(() => {
    const active = activeRef.current
    const nav = active?.parentElement
    if (!active || !nav) return
    nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.clientWidth) / 2
  }, [view])

  return (
    <nav
      aria-label="비상 보기"
      // 이 메뉴 안에서 좌우로 미는 건 메뉴 스크롤이지 달 넘기기가 아니다
      data-swipe-ignore
      className="no-scrollbar -mx-4 grid auto-cols-[minmax(4rem,1fr)] grid-flow-col overflow-x-auto border-b px-2 md:mx-0 md:px-0"
    >
      {LEDGER_VIEWS.map((item) => {
        const isActive = item.value === view
        return (
          <Link
            key={item.value}
            ref={isActive ? activeRef : undefined}
            href={`/?view=${item.value}&d=${anchor}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex min-h-11 items-center justify-center px-3 text-[15px] whitespace-nowrap transition-colors",
              isActive
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
            {isActive ? (
              <span
                aria-hidden
                className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-red-400"
              />
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
