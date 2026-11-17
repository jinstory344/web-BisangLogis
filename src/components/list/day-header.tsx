import type { ReactNode } from "react"

import { UNDER_STICKY_HEAD } from "@/components/layout/sticky-head"
import { getWeekdayLabel } from "@/lib/date"
import { cn } from "@/lib/utils"

interface DayHeaderProps {
  /** yyyy-MM-dd */
  date: string
  /** 그날 합계 (이미 "300,000원" 형태로 만든 글자, 색을 입힌 조각들도 가능) */
  totalLabel: ReactNode
  /** 목록이 여러 달에 걸쳐 있으면 월도 함께 보여 준다. */
  showMonth?: boolean
  /** 고정될 위치 — 기본은 위 고정 머리 바로 밑. 그날 목록이 끝날 때까지 붙어 있다. */
  stickyTopClassName?: string
}

/** 모바일 목록의 날짜 머리글: `12 [목요일]            500,000원` */
export function DayHeader({
  date,
  totalLabel,
  showMonth = false,
  stickyTopClassName = UNDER_STICKY_HEAD,
}: DayHeaderProps) {
  return (
    // 바깥은 고정용(불투명 바탕), 안쪽은 원래의 옅은 회색 줄
    <div className={cn("sticky z-10 bg-background md:static", stickyTopClassName)}>
    <div className="flex items-center justify-between bg-muted/50 px-4 py-2">
      <span className="flex items-center gap-1.5">
        {showMonth ? (
          <span className="text-xs text-muted-foreground">
            {Number(date.slice(5, 7))}월
          </span>
        ) : null}
        <span className="text-lg leading-none font-semibold tabular-nums">
          {Number(date.slice(8, 10))}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
          {getWeekdayLabel(date)}요일
        </span>
      </span>
      <span className="text-sm text-muted-foreground tabular-nums">
        {totalLabel}
      </span>
    </div>
    </div>
  )
}
