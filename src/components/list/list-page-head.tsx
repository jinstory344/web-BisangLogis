import { Search } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { TabsList, TabsTrigger } from "@/components/ui/tabs"

/**
 * 모바일에서 첫째 고정 줄(ListPageHead) 바로 아래에 붙는 둘째 고정 영역의 top.
 * ListPageHead의 모바일 높이 = 위 여백 8px + 제목 줄 40px + 탭 36px = 84px(5.25rem).
 */
export const LIST_SUB_STICKY_CLASS =
  "sticky top-[5.25rem] z-20 -mx-4 bg-background px-4 md:static md:mx-0 md:px-0"

/** 목록 위 거르기 칩을 조금 작게 (36px) — 비상 화면 칩과 같은 크기 */
export const LIST_CHIP_CLASS = "min-h-9 px-3.5 text-[13px] md:min-h-8"

/**
 * 매출·지출·배차 목록 화면의 머리 (Tabs 안에 둔다).
 * 모바일: 비상 화면과 같은 모양(왼쪽 검색 · 가운데 제목) + 밑줄 탭, 위에 고정되어 스크롤해도 보인다.
 * 데스크톱: 왼쪽 큰 제목 + 오른쪽 등록 버튼(기존 모양), 고정하지 않는다.
 */
export function ListPageHead({
  title,
  desktopTitle,
  desktopAction,
  tabs,
}: {
  title: string
  desktopTitle: string
  desktopAction?: ReactNode
  tabs: { value: string; label: string }[]
}) {
  return (
    <div className="sticky top-0 z-30 -mx-4 bg-background px-4 pt-2 md:static md:mx-0 md:px-0 md:pt-0">
      <header className="grid h-10 grid-cols-[2.5rem_1fr_2.5rem] items-center md:hidden">
        <Link
          href="/search"
          aria-label="검색"
          className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Search className="size-5" />
        </Link>
        <h1 className="text-center text-lg font-semibold tracking-tight">{title}</h1>
        <span aria-hidden />
      </header>

      <div className="hidden items-center justify-between gap-4 md:flex">
        <h1 className="text-2xl font-semibold">{desktopTitle}</h1>
        {desktopAction}
      </div>

      <TabsList
        variant="line"
        className="-mx-4 h-9 w-[calc(100%+2rem)] gap-0 border-b p-0 group-data-horizontal/tabs:h-9 md:mx-0 md:mt-4 md:w-fit md:border-b-0"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="h-full rounded-none px-4 text-sm font-normal data-active:font-semibold after:bg-red-400 group-data-horizontal/tabs:after:inset-x-3 group-data-horizontal/tabs:after:bottom-[-1px] md:flex-none"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  )
}
