"use client"

import { useState, type ReactNode } from "react"

import type { CarTab } from "@/lib/car-ledger/tabs"
import { StickyHead } from "@/components/layout/sticky-head"
import { MonthSwipe } from "@/components/list/month-swipe"
import { cn } from "@/lib/utils"

/**
 * 차계부 탭 줄 + 탭 내용. 모든 탭 내용은 서버에서 한 번에 만들어 두고, 탭은 화면 안에서만 바꾼다
 * (예전엔 탭마다 서버에 다시 가서 느렸음). 주소의 tab 값만 조용히 바꿔 새로 고침해도 같은 탭이 열린다.
 */
export function TabPanels({
  tabs,
  initial,
  before,
  panels,
  addButtons,
  stickyExtras = {},
}: {
  tabs: readonly CarTab[]
  initial: string
  /** 탭 줄 위(이달 비용 요약) — 달 쓸어 넘기기 안에 함께 넣는다 */
  before: ReactNode
  panels: Record<string, ReactNode>
  /** 탭마다 ＋ 버튼(기본 종류가 탭에 따라 다름) */
  addButtons: Record<string, ReactNode>
  /** 탭 줄 바로 아래에 함께 고정될 것 (정비 탭의 [전체 ▾] 항목 고르기 등) */
  stickyExtras?: Record<string, ReactNode>
}) {
  const [current, setCurrent] = useState(initial)

  function select(value: string) {
    setCurrent(value)
    try {
      const url = new URL(window.location.href)
      url.searchParams.set("tab", value)
      url.searchParams.delete("item")
      window.history.replaceState(window.history.state, "", url)
    } catch {
      // 주소를 못 바꿔도 탭은 바뀐다
    }
  }

  return (
    <>
      <MonthSwipe className="flex flex-col gap-3">
      {/* 위쪽 고정: 머리(제목·보기 탭, 113px) 바로 밑에 비용 박스·탭 줄·항목 고르기까지 고정하고 아래 내용만 스크롤.
          높이를 재서(--sticky-head-h) 목록의 날짜 줄이 이 묶음 바로 밑에 붙어 고정되게 한다 */}
      <StickyHead
        topPx={112}
        className="top-[112px] z-20 -mx-4 flex flex-col gap-2 px-4 pb-2 md:static md:mx-0 md:px-0"
      >
      {before}
      <nav
        aria-label="차계부 보기"
        className="-mx-4 flex overflow-x-auto border-b px-2 [scrollbar-width:none] md:mx-0 md:px-0"
      >
        {tabs.map((tab) => {
          const isActive = tab.value === current
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => select(tab.value)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex min-h-10 flex-1 shrink-0 items-center justify-center px-2 text-sm whitespace-nowrap transition-colors",
                isActive ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {isActive ? (
                <span aria-hidden className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[#2a95a5]" />
              ) : null}
            </button>
          )
        })}
      </nav>
      {stickyExtras[current]}
      </StickyHead>
      {panels[current]}
      </MonthSwipe>
      {/* ＋는 화면에 고정되므로 쓸어 넘기기(transform) 밖에 둔다 */}
      {addButtons[current]}
    </>
  )
}
