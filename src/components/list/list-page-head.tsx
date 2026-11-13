
import type { ReactNode } from "react"

import { ChartNoAxesColumn } from "lucide-react"
import Link from "next/link"

import { SearchButton } from "@/components/layout/search-button"

/**
 * 모바일에서 첫째 고정 줄(ListPageHead) 바로 아래에 붙는 둘째 고정 영역의 top.
 * ListPageHead의 모바일 높이 = 위 여백 8px + 제목 줄 40px + 달 이동 40px = 88px(5.5rem).
 */
export const LIST_SUB_STICKY_CLASS =
  "sticky top-[5.5rem] z-20 -mx-4 bg-background px-4 md:static md:mx-0 md:px-0"

/** 목록 위 거르기 칩을 조금 작게 (36px) — 비상 화면 칩과 같은 크기 */
export const LIST_CHIP_CLASS = "min-h-9 px-3.5 text-[13px] md:min-h-8"

/**
 * 매출·지출·배차 목록 화면의 머리.
 * 모바일: HOME 화면과 같은 순서(왼쪽 검색 · 가운데 제목 · 오른쪽 통계 아이콘 → ‹ 달 ›), 위에 고정되어 스크롤해도 보인다.
 * 월간 집계는 통계 화면과 같은 내용이라 탭을 두지 않고, 오른쪽 위 아이콘으로 그 달 통계에 간다.
 * 데스크톱: 왼쪽 큰 제목 + 오른쪽 등록 버튼(기존 모양), 고정하지 않는다.
 */
export function ListPageHead({
  title,
  desktopTitle,
  desktopAction,
  statsHref,
  monthNav,
}: {
  title: string
  desktopTitle: string
  desktopAction?: ReactNode
  /** 오른쪽 위 통계 아이콘이 갈 곳 (그 달의 이 종류 통계) */
  statsHref: string
  /** 제목과 탭 사이의 ‹ 2026년 11월 › (모바일만, HOME과 같은 자리) */
  monthNav?: ReactNode
}) {
  return (
    <div className="sticky top-0 z-30 -mx-4 bg-background px-4 pt-2 md:static md:mx-0 md:px-0 md:pt-0">
      <header className="grid h-10 grid-cols-[2.5rem_1fr_2.5rem] items-center md:hidden">
        <SearchButton />
        <h1 className="text-center text-lg font-semibold tracking-tight">{title}</h1>
        <Link
          href={statsHref}
          aria-label={`${title} 통계`}
          className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <ChartNoAxesColumn className="size-5" />
        </Link>
      </header>

      {monthNav ? <div className="md:hidden">{monthNav}</div> : null}

      <div className="hidden items-center justify-between gap-4 md:flex">
        <h1 className="text-2xl font-semibold">{desktopTitle}</h1>
        {desktopAction}
      </div>

    </div>
  )
}
