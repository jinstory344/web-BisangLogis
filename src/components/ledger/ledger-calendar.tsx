"use client"

import { useMemo, useState } from "react"

import { buildCalendarCells, type DayBucket } from "@/lib/ledger"
import { cn } from "@/lib/utils"

import type { DayLedgerEntry } from "@/app/(app)/ledger-data"

import { EXPENSE_TEXT_CLASS, INCOME_TEXT_CLASS } from "./colors"
import { LedgerDayList } from "./ledger-day-list"

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

/** 칸 폭이 좁아서 자릿수가 많으면 글씨를 한 단계 더 줄인다. */
function amountSizeClass(text: string): string {
  return text.length > 9 ? "text-[8.5px]" : "text-[10px]"
}

function Amount({ value, className }: { value: number; className?: string }) {
  // 칸이 좁아 "원" 없이 숫자만 (펼친 목록에는 원 단위로 나온다)
  const text = value.toLocaleString("ko-KR")
  return (
    <span className={cn("block truncate leading-tight", amountSizeClass(text), className)}>
      {text}
    </span>
  )
}

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
  const cells = useMemo(() => buildCalendarCells(anchor), [anchor])
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
      <div className="-mx-4 grid grid-cols-7 border-b md:mx-0">
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

      <div className="-mx-4 grid grid-cols-7 md:mx-0">
        {cells.map((cell, index) => {
          const bucket = cell.inMonth ? byDate.get(cell.date) : undefined
          const day = Number(cell.date.slice(8, 10))
          const weekday = index % 7
          const isSelected = cell.date === selected
          const isToday = cell.date === today
          return (
            <button
              key={cell.date}
              type="button"
              disabled={!cell.inMonth}
              onClick={() => setSelected(isSelected ? null : cell.date)}
              aria-pressed={isSelected}
              aria-label={`${Number(cell.date.slice(5, 7))}월 ${day}일`}
              className={cn(
                "flex min-h-[4.5rem] min-w-0 flex-col justify-between border-r border-b px-0.5 pt-0.5 pb-1 text-left tabular-nums",
                weekday === 6 && "border-r-0",
                isSelected && "bg-muted",
                !cell.inMonth && "opacity-35"
              )}
            >
              <span
                className={cn(
                  "w-fit rounded px-1 text-xs",
                  isToday
                    ? "bg-foreground font-semibold text-background"
                    : weekday === 0
                      ? "text-red-500"
                      : weekday === 6
                        ? "text-blue-500"
                        : undefined
                )}
              >
                {day === 1 ? `${Number(cell.date.slice(5, 7))}.1` : day}
              </span>
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
        })}
      </div>

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
