"use client"

import { useMemo } from "react"

import { DayPickCalendar, DayPickEmpty, type CalendarLine } from "@/components/list/day-pick-calendar"
import { entryRowsInRange, type CarEntry } from "@/lib/car-ledger/entries"

import { EntryDayList } from "./entry-day-list"

/**
 * 차계부 달력: 날짜 칸마다 그날 차 비용, 칸을 누르면 다른 화면으로 가지 않고 바로 아래에 그날 내역(정비·주유·요소수 전부).
 * HOME 달력처럼 처음엔 이번 달이면 오늘, 아니면 아무 날도 고르지 않는다. 같은 날짜를 다시 누르면 접힌다.
 */
export function CarCalendar({
  anchor,
  today,
  daySums,
  entries,
}: {
  anchor: string
  today: string
  /** 날짜 → 그날 금액 합(할부는 회차 금액) */
  daySums: Record<string, number>
  /** 그 달에 돈이 나간 기록들 */
  entries: readonly CarEntry[]
}) {
  const cells = useMemo(() => {
    const result: Record<string, CalendarLine[]> = {}
    for (const [date, sum] of Object.entries(daySums)) {
      if (sum) result[date] = [{ text: sum.toLocaleString("ko-KR") }]
    }
    return result
  }, [daySums])

  return (
    <DayPickCalendar
      anchor={anchor}
      today={today}
      cells={cells}
      renderDay={(date) => {
        const rows = entryRowsInRange(entries, date, date)
        if (rows.length === 0) {
          return <DayPickEmpty>이 날은 기록된 차 비용이 없습니다.</DayPickEmpty>
        }
        // 날짜 줄·기록 줄 모두 다른 목록(지출·HOME)과 같은 모양
        return <EntryDayList rows={rows} emptyMessage="" />
      }}
    />
  )
}
