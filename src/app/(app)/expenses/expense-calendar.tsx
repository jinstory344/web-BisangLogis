"use client"

import { useMemo } from "react"

import { DayPickCalendar, DayPickEmpty, type CalendarLine } from "@/components/list/day-pick-calendar"
import { groupRowsByDate } from "@/lib/day-groups"
import type { ExpenseRow } from "@/lib/supabase/database.types"

import { ExpenseList } from "./expense-list"

/**
 * 지출 달력 보기: HOME 달력처럼 날짜를 누르면 바로 아래에 그날 지출(일일 목록과 같은 줄·작업 시트).
 * 그 달 지출(거르기 적용)을 한 번에 받아 두고 날짜를 바꿀 때는 서버에 다시 가지 않는다.
 */
export function ExpenseCalendar({
  anchor,
  today,
  cells,
  expenses,
  serviceItemNames,
}: {
  anchor: string
  today: string
  cells: Record<string, CalendarLine[]>
  /** 그 달 지출 (거르기 적용, 그날 안에서는 최근 등록 먼저) */
  expenses: ExpenseRow[]
  /** 지출 id → 정비 항목 이름들 */
  serviceItemNames: Record<string, string[]>
}) {
  const byDate = useMemo(() => groupRowsByDate(expenses, (expense) => expense.expense_date), [expenses])

  return (
    <DayPickCalendar
      anchor={anchor}
      today={today}
      cells={cells}
      renderDay={(date) => {
        const rows = byDate.get(date) ?? []
        if (rows.length === 0) {
          return <DayPickEmpty>이 날은 기록된 지출이 없습니다.</DayPickEmpty>
        }
        return (
          // 목록의 첫 날짜 줄이 위로 붙는 만큼(-mt-3) 되돌린다
          <div className="pt-3">
            <ExpenseList
              key={date}
              expenses={rows}
              summary={{
                count: rows.length,
                total: rows.reduce((sum, row) => sum + row.amount, 0),
                byMajor: [],
              }}
              page={1}
              totalPages={1}
              serviceItemNames={serviceItemNames}
            />
          </div>
        )
      }}
    />
  )
}
