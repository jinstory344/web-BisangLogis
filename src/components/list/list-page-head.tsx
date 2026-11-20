
import type { ReactNode } from "react"


import { PageTitle } from "@/components/layout/page-title"
import { SearchButton } from "@/components/layout/search-button"

/**
 * 모바일에서 첫째 고정 줄(ListPageHead) 바로 아래에 붙는 둘째 고정 영역의 top.
 * ListPageHead의 모바일 높이 = 위 여백 24px + 제목 줄 40px = 64px(4rem). (달 이동 줄 대신 제목 오른쪽 달력 아이콘)
 * 위 여백은 아이폰 시계줄 바로 밑에 제목이 붙어 흐려 보이지 않게 넉넉히 둔다.
 */
/** ListPageHead 모바일 높이(px) — 합계 줄이 그 밑에 붙는 위치 */
export const LIST_PAGE_HEAD_PX = 64

export const LIST_SUB_STICKY_CLASS =
  "sticky top-[4rem] z-20 -mx-4 bg-background px-4"

/** 목록 위 거르기 칩을 조금 작게 (36px) — 비상 화면 칩과 같은 크기 */
export const LIST_CHIP_CLASS = "min-h-9 px-3.5 text-[13px]"

/**
 * 매출·지출·배차 목록 화면의 머리.
 * 모바일: HOME 화면과 같은 모양(왼쪽 검색 · 가운데 제목 · 오른쪽 달력 아이콘), 위에 고정되어 스크롤해도 보인다.
 * 달은 아이콘으로 고르고, 이전·다음 달은 목록을 쓸어 넘긴다. 통계는 메뉴에서 간다.
 * 컴퓨터 화면도 모바일과 같은 모양(사용자 요청 2026-11-20). desktopTitle·desktopAction은 예전 호출을 위해 남겨 둔 값이라 쓰지 않는다.
 */
export function ListPageHead({
  title,
  periodPicker,
  titleBarClassName,
}: {
  title: string
  desktopTitle?: string
  desktopAction?: ReactNode
  /** 오른쪽 위 달력 아이콘(누르면 달 고르기). 이전·다음 달은 목록을 쓸어 넘긴다. */
  periodPicker?: ReactNode
  /** 제목 밑 짧은 색 줄 (메뉴별 색, 예: 배차 노랑) */
  titleBarClassName?: string
}) {
  return (
    <div className="sticky top-0 z-30 -mx-4 bg-background px-4 pt-6">
      <header className="grid h-10 grid-cols-[2.5rem_1fr_2.5rem] items-center">
        <SearchButton />
        <PageTitle title={title} barClassName={titleBarClassName} />
        {periodPicker ?? <span aria-hidden />}
      </header>
    </div>
  )
}
