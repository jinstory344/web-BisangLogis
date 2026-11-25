"use client"

import { useMemo } from "react"

import { DayHeader } from "@/components/list/day-header"
import { DayPickCalendar, DayPickEmpty, type CalendarLine } from "@/components/list/day-pick-calendar"
import { formatKm } from "@/lib/car-ledger/constants"
import { sortEntriesDesc, type CarEntry } from "@/lib/car-ledger/entries"
import { formatLiters } from "@/lib/fuel"
import { formatKRW } from "@/lib/money"

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
        const shown = sortEntriesDesc(entries.filter((entry) => entry.dates.includes(date)))
        if (shown.length === 0) {
          return <DayPickEmpty>이 날은 기록된 차 비용이 없습니다.</DayPickEmpty>
        }
        return (
          // 날짜 줄은 HOME 일일 장부처럼, 기록 줄은 예전 차계부 달력 줄 그대로
          <section className="-mx-4 border-b">
            <DayHeader date={date} totalLabel={formatKRW(daySums[date] ?? 0)} />
            <ul className="flex flex-col">
              {shown.map((entry) => (
                <li key={entry.key} className="border-t">
                  <EntryLink entry={entry} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium">{entry.kind}</span>
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
          </section>
        )
      }}
    />
  )
}
