"use client"

import { useState } from "react"

import {
  CalendarAmount,
  CalendarDayNumber,
  CalendarGrid,
  calendarCellClass,
} from "@/components/ledger/calendar-grid"
import { formatEntryDate, formatKm } from "@/lib/car-ledger/constants"
import { sortEntriesDesc, type CarEntry } from "@/lib/car-ledger/entries"
import { formatLiters } from "@/lib/fuel"
import { cn } from "@/lib/utils"

import { EntryLink } from "./entry-link"

/** 기록 한 줄 아래 작은 글씨: 정비 항목 / 리터·km·정비소·카드 */
function entryDetail(entry: CarEntry): string {
  return [
    entry.items.length ? entry.items.map((line) => line.item).join(" · ") : null,
    entry.liters !== null ? formatLiters(entry.liters) : null,
    entry.km !== null ? formatKm(entry.km) : null,
    entry.vendor,
    entry.installmentMonths ? `할부 ${entry.installmentMonths}개월` : null,
    entry.cardName,
  ]
    .filter(Boolean)
    .join(" · ")
}

/**
 * 차계부 달력: 날짜 칸마다 그날 차 비용, 칸을 누르면 다른 화면으로 가지 않고 바로 아래에 그날 내역(정비·주유·요소수 전부).
 * 처음엔 그 달 전체 내역. 같은 날짜를 다시 누르면 전체로 돌아간다.
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
  const [selected, setSelected] = useState<string | null>(null)
  const shown = sortEntriesDesc(selected ? entries.filter((entry) => entry.dates.includes(selected)) : [...entries])
  const monthLabel = `${Number(anchor.slice(5, 7))}월`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        <CalendarGrid
          anchor={anchor}
          today={today}
          renderCell={(cell) => {
            const sum = cell.inMonth ? daySums[cell.date] : undefined
            const content = (
              <>
                <CalendarDayNumber cell={cell} />
                {sum ? (
                  <span className="flex flex-col items-end text-right">
                    <CalendarAmount value={sum} />
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
            const isSelected = selected === cell.date
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
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">
          {selected ? formatEntryDate(selected, today) : `${monthLabel} 전체`} · {shown.length}건
        </span>
        {selected ? (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
          >
            {monthLabel} 전체 보기
          </button>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {selected ? "이날 기록이 없어요." : "이달 기록이 없어요."}
        </p>
      ) : (
        <ul className="-mx-4 flex flex-col border-t">
          {shown.map((entry) => (
            <li key={entry.key} className="border-b">
              <EntryLink entry={entry} className="px-4 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-sm">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatEntryDate(selected ?? entry.dates.find((date) => date.startsWith(anchor.slice(0, 7))) ?? entry.date, today)}
                    </span>{" "}
                    <span className="font-medium">{entry.kind}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {entry.amount.toLocaleString("ko-KR")}
                  </span>
                </div>
                {entryDetail(entry) ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{entryDetail(entry)}</p>
                ) : null}
              </EntryLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
