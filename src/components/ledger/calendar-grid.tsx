import type { ReactNode } from "react"

import { buildCalendarCells } from "@/lib/ledger"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

/** 칸 폭이 좁아서 자릿수가 많으면 글씨를 한 단계 더 줄인다. */
function amountSizeClass(text: string): string {
  return text.length > 9 ? "text-[8.5px]" : "text-[10px]"
}

/** 달력 칸 안의 금액 한 줄 (칸이 좁아 "원" 없이 숫자만). text를 주면 그 글자를 그대로. */
export function CalendarAmount({
  value,
  text,
  className,
}: {
  value?: number
  text?: string
  className?: string
}) {
  const shown = text ?? (value ?? 0).toLocaleString("ko-KR")
  return (
    <span className={cn("block truncate leading-tight", amountSizeClass(shown), className)}>
      {shown}
    </span>
  )
}

export interface CalendarCellInfo {
  date: string
  inMonth: boolean
  day: number
  /** 0=일 … 6=토 */
  weekday: number
  isToday: boolean
}

/** 칸 하나의 모양 (버튼이든 링크든 같은 모양) */
export function calendarCellClass(cell: CalendarCellInfo, isSelected = false): string {
  return cn(
    "flex min-h-[4.5rem] min-w-0 flex-col justify-between border-r border-b px-0.5 pt-0.5 pb-1 text-left tabular-nums",
    cell.weekday === 6 && "border-r-0",
    isSelected && "bg-muted",
    !cell.inMonth && "opacity-35"
  )
}

/** 칸 왼쪽 위 날짜 숫자 (오늘은 반전, 일요일 빨강·토요일 파랑, 1일은 "11.1") */
export function CalendarDayNumber({ cell }: { cell: CalendarCellInfo }) {
  return (
    <span
      className={cn(
        "w-fit rounded px-1 text-xs",
        cell.isToday
          ? "bg-foreground font-semibold text-background"
          : cell.weekday === 0
            ? "text-red-500"
            : cell.weekday === 6
              ? "text-blue-500"
              : undefined
      )}
    >
      {cell.day === 1 ? `${Number(cell.date.slice(5, 7))}.1` : cell.day}
    </span>
  )
}

/**
 * 한 달 달력 틀(요일 줄 + 날짜 칸). 칸은 쓰는 쪽이 renderCell로 그린다(HOME은 누르면 펼치는 버튼,
 * 매출·지출·배차·차계부는 그날 목록으로 가는 링크).
 */
export function CalendarGrid({
  anchor,
  today,
  renderCell,
}: {
  anchor: string
  today: string
  renderCell: (cell: CalendarCellInfo) => ReactNode
}) {
  const cells = buildCalendarCells(anchor)
  return (
    <>
      <div className="-mx-4 grid grid-cols-7 border-b">
        {WEEKDAYS.map((label, index) => (
          <span
            key={label}
            className={cn(
              "py-1 text-center text-xs",
              index === 0
                ? "text-red-500"
                : index === 6
                  ? "text-blue-500"
                  : "text-muted-foreground"
            )}
          >
            {label}
          </span>
        ))}
      </div>

      <div className="-mx-4 grid grid-cols-7">
        {cells.map((cell, index) =>
          renderCell({
            date: cell.date,
            inMonth: cell.inMonth,
            day: Number(cell.date.slice(8, 10)),
            weekday: index % 7,
            isToday: cell.date === today,
          })
        )}
      </div>
    </>
  )
}
