"use client"

import { useMemo, useState } from "react"

import type { DayBucket } from "@/lib/ledger"

import type { DayLedgerEntry } from "@/app/(app)/ledger-data"

import {
  CalendarAmount as Amount,
  CalendarDayNumber,
  CalendarGrid,
  calendarCellClass,
} from "./calendar-grid"
import { EXPENSE_TEXT_CLASS, INCOME_TEXT_CLASS } from "./colors"
import { LedgerDayList } from "./ledger-day-list"

/**
 * 달력 장부: 그 달 달력의 날짜마다 수입(파랑)·지출(빨강)·합계를 원 단위로 보여 준다.
 * 날짜를 누르면 달력 아래에 그날의 매출·지출 목록이 펼쳐진다(다시 누르면 접힘).
 */
export function LedgerCalendar({
  anchor,
  today,
  buckets,
}: {
  anchor: string
  today: string
  buckets: DayBucket<DayLedgerEntry>[]
}) {
  const byDate = useMemo(
    () => new Map(buckets.map((bucket) => [bucket.date, bucket])),
    [buckets]
  )
  const monthPrefix = anchor.slice(0, 7)
  // 처음엔 이번 달이면 오늘, 아니면 아무 날도 고르지 않는다.
  const [selected, setSelected] = useState<string | null>(
    today.slice(0, 7) === monthPrefix ? today : null
  )
  const selectedBucket = selected ? byDate.get(selected) : undefined

  return (
    <div className="flex flex-col">
      <CalendarGrid
        anchor={anchor}
        today={today}
        renderCell={(cell) => {
          const bucket = cell.inMonth ? byDate.get(cell.date) : undefined
          const isSelected = cell.date === selected
          return (
            <button
              key={cell.date}
              type="button"
              disabled={!cell.inMonth}
              onClick={() => setSelected(isSelected ? null : cell.date)}
              aria-pressed={isSelected}
              aria-label={`${Number(cell.date.slice(5, 7))}월 ${cell.day}일`}
              className={calendarCellClass(cell, isSelected)}
            >
              <CalendarDayNumber cell={cell} />
              {bucket ? (
                <span className="flex flex-col items-end text-right">
                  {bucket.income > 0 ? (
                    <Amount value={bucket.income} className={INCOME_TEXT_CLASS} />
                  ) : null}
                  {bucket.expense > 0 ? (
                    <Amount value={bucket.expense} className={EXPENSE_TEXT_CLASS} />
                  ) : null}
                  {bucket.income > 0 && bucket.expense > 0 ? (
                    <Amount value={bucket.net} />
                  ) : null}
                </span>
              ) : null}
            </button>
          )
        }}
      />

      {selected ? (
        <div className="mt-2">
          <LedgerDayList
            buckets={selectedBucket ? [selectedBucket] : []}
            emptyMessage="이 날은 기록된 매출·지출이 없습니다."
          />
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          날짜를 누르면 그날 내역이 여기에 보여요.
        </p>
      )}
    </div>
  )
}
