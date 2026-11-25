"use client"

import { useState, type ReactNode } from "react"

import {
  CalendarAmount,
  CalendarDayNumber,
  CalendarGrid,
  calendarCellClass,
} from "@/components/ledger/calendar-grid"
import { cn } from "@/lib/utils"

export interface CalendarLine {
  /** 칸이 좁아 "원" 없이 숫자만 (예: "125,000" / "3건") */
  text: string
  className?: string
}

interface DayPickCalendarProps {
  /** 그 달 아무 날 (yyyy-MM-dd) */
  anchor: string
  today: string
  /** 날짜 → 칸 안 줄들 (기록 없는 날은 빠져 있음) */
  cells: Record<string, CalendarLine[]>
  /** 고른 날의 내역 (기록이 없으면 "이 날은 기록된 ○○이 없습니다." 같은 글도 이쪽에서) */
  renderDay: (date: string) => ReactNode
}

/**
 * 날짜 고르기 달력 + 고른 날 내용 칸 (HOME 달력과 같은 동작).
 * 처음엔 이번 달이면 오늘, 아니면 아무 날도 고르지 않는다. 칸을 누르면 다른 화면으로 가지 않고
 * 달력 바로 아래에 그날 내역이 펼쳐지고, 같은 칸을 다시 누르면 접힌다.
 * 달이 바뀌면(anchor) 고른 날을 처음 상태로 되돌린다.
 */
export function DayPickCalendar(props: DayPickCalendarProps) {
  return <DayPickCalendarInner key={props.anchor.slice(0, 7)} {...props} />
}

function DayPickCalendarInner({ anchor, today, cells, renderDay }: DayPickCalendarProps) {
  const [selected, setSelected] = useState<string | null>(
    today.slice(0, 7) === anchor.slice(0, 7) ? today : null
  )

  return (
    <div className="flex flex-col">
      <CalendarGrid
        anchor={anchor}
        today={today}
        renderCell={(cell) => {
          const lines = cell.inMonth ? cells[cell.date] : undefined
          const content = (
            <>
              <CalendarDayNumber cell={cell} />
              {lines && lines.length > 0 ? (
                <span className="flex flex-col items-end text-right">
                  {lines.map((line, index) => (
                    <CalendarAmount key={index} text={line.text} className={line.className} />
                  ))}
                </span>
              ) : null}
            </>
          )
          if (!cell.inMonth) {
            return (
              <span key={cell.date} aria-hidden className={calendarCellClass(cell)}>
                {content}
              </span>
            )
          }
          const isSelected = cell.date === selected
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => setSelected(isSelected ? null : cell.date)}
              aria-pressed={isSelected}
              aria-label={`${Number(cell.date.slice(5, 7))}월 ${cell.day}일`}
              className={cn(calendarCellClass(cell, isSelected), "active:bg-muted md:hover:bg-muted/50")}
            >
              {content}
            </button>
          )
        }}
      />

      {selected ? (
        <div className="mt-2">{renderDay(selected)}</div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          날짜를 누르면 그날 내역이 여기에 보여요.
        </p>
      )}
    </div>
  )
}

/** 고른 날에 기록이 없을 때 (HOME과 같은 모양) */
export function DayPickEmpty({ children }: { children: ReactNode }) {
  return <p className="py-12 text-center text-sm text-muted-foreground">{children}</p>
}
