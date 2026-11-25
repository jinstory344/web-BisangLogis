"use client"

import { useMemo } from "react"

import { DayPickCalendar, DayPickEmpty, type CalendarLine } from "@/components/list/day-pick-calendar"
import { groupRowsByDate } from "@/lib/day-groups"
import type { DispatchRow } from "@/lib/supabase/database.types"

import { DispatchList } from "./dispatch-list"

/**
 * 배차 달력 보기: HOME 달력처럼 날짜를 누르면 바로 아래에 그날 배차(일일 목록과 같은 줄·작업 시트·문자 보내기).
 * 그 달 배차(거래처 거르기 적용)를 한 번에 받아 두고 날짜를 바꿀 때는 서버에 다시 가지 않는다.
 */
export function DispatchCalendar({
  anchor,
  today,
  cells,
  dispatches,
  clientNameMap,
}: {
  anchor: string
  today: string
  cells: Record<string, CalendarLine[]>
  /** 그 달 배차 (거르기 적용, 그날 안에서는 최근 등록 먼저) */
  dispatches: DispatchRow[]
  clientNameMap: Record<string, string>
}) {
  const byDate = useMemo(() => groupRowsByDate(dispatches, (dispatch) => dispatch.dispatch_date), [dispatches])

  return (
    <DayPickCalendar
      anchor={anchor}
      today={today}
      cells={cells}
      renderDay={(date) => {
        const rows = byDate.get(date) ?? []
        if (rows.length === 0) {
          return <DayPickEmpty>이 날은 기록된 배차가 없습니다.</DayPickEmpty>
        }
        return (
          // 목록의 첫 날짜 줄이 위로 붙는 만큼(-mt-3) 되돌린다
          <div className="pt-3">
            <DispatchList
              key={date}
              dispatches={rows}
              clientNameMap={clientNameMap}
              totalCount={rows.length}
              summary={{
                freightAmount: rows.reduce((sum, row) => sum + (row.freight_amount ?? 0), 0),
                feeAmount: rows.reduce((sum, row) => sum + (row.fee_amount ?? 0), 0),
              }}
              page={1}
              totalPages={1}
              showFilteredTotals={false}
            />
          </div>
        )
      }}
    />
  )
}
