"use client"

import { useMemo } from "react"

import { DayPickCalendar, DayPickEmpty, type CalendarLine } from "@/components/list/day-pick-calendar"
import { groupRowsByDate } from "@/lib/day-groups"
import type { SaleRow } from "@/lib/supabase/database.types"

import { SalesList } from "./sales-list"

/**
 * 매출 달력 보기: HOME 달력처럼 날짜를 누르면 바로 아래에 그날 매출(일일 목록과 같은 줄·작업 시트).
 * 그 달 매출(거르기 적용)을 한 번에 받아 두고 날짜를 바꿀 때는 서버에 다시 가지 않는다.
 */
export function SalesCalendar({
  anchor,
  today,
  cells,
  sales,
}: {
  anchor: string
  today: string
  cells: Record<string, CalendarLine[]>
  /** 그 달 매출 (거르기 적용, 그날 안에서는 최근 등록 먼저) */
  sales: SaleRow[]
}) {
  const byDate = useMemo(() => groupRowsByDate(sales, (sale) => sale.sale_date), [sales])

  return (
    <DayPickCalendar
      anchor={anchor}
      today={today}
      cells={cells}
      renderDay={(date) => {
        const rows = byDate.get(date) ?? []
        if (rows.length === 0) {
          return <DayPickEmpty>이 날은 기록된 매출이 없습니다.</DayPickEmpty>
        }
        return (
          // 목록의 첫 날짜 줄이 위로 붙는 만큼(-mt-3) 되돌린다
          <div className="pt-3">
            <SalesList
              key={date}
              sales={rows}
              summary={{
                count: rows.length,
                totalAmount: rows.reduce((sum, row) => sum + row.total_amount, 0),
                supplyAmount: rows.reduce((sum, row) => sum + row.supply_amount, 0),
              }}
              page={1}
              totalPages={1}
              selectable={false}
            />
          </div>
        )
      }}
    />
  )
}
