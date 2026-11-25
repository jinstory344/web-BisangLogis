"use client"

import { UNDER_STICKY_HEAD } from "@/components/layout/sticky-head"
import { DayHeader } from "@/components/list/day-header"
import { formatKm, unitPrice } from "@/lib/car-ledger/constants"
import { carEntryPaymentLabel, type CarEntryRow } from "@/lib/car-ledger/entries"
import { groupByDay, spansMultipleMonths } from "@/lib/day-groups"
import { formatLiters } from "@/lib/fuel"
import { formatKRW } from "@/lib/money"
import { cn } from "@/lib/utils"

import { EntryLink } from "./entry-link"

/** 날짜 줄은 위 고정 머리(비용 박스·탭 줄) 바로 밑에 붙는다. 컴퓨터 화면은 머리가 고정되지 않아 맨 위. */
const DAY_STICKY_TOP = cn(UNDER_STICKY_HEAD, "md:top-0")

/** 왼쪽 제목: 정비면 항목 이름들("엔진오일 · 배터리"), 아니면 종류("주유") */
function rowTitle(row: CarEntryRow): string {
  const names = row.entry.items.map((line) => line.item)
  return names.length ? names.join(" · ") : row.entry.kind
}

/** 아래 작은 글씨: 리터·단가 · km · 정비소/주유소 · 비고 */
function rowNote(row: CarEntryRow): string {
  const { entry } = row
  const price = unitPrice(entry.amount, entry.liters)
  return [
    entry.liters !== null ? formatLiters(entry.liters) : null,
    price !== null ? `${price.toLocaleString("ko-KR")}원/L` : null,
    entry.km !== null ? formatKm(entry.km) : null,
    entry.vendor,
    entry.memo,
  ]
    .map((text) => text?.trim())
    .filter(Boolean)
    .join(" · ")
}

/**
 * 차계부 날짜별 목록 — 지출·HOME 일일 목록과 같은 모양.
 * 날짜 머리 줄(그날 합계, 스크롤하면 위 고정 머리 밑에 붙음) + 한 건당 두 줄
 * (제목 / 리터·km·장소·비고 · 오른쪽 금액 / 결제수단). 줄을 누르면 수정 화면.
 */
export function EntryDayList({
  rows,
  emptyMessage,
  className,
}: {
  /** 최근 날짜부터 정렬된 줄 */
  rows: CarEntryRow[]
  emptyMessage: string
  className?: string
}) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }

  const groups = groupByDay(
    rows,
    (row) => row.date,
    (row) => row.amount ?? 0
  )
  const spansMonths = spansMultipleMonths(groups)
  const spansYears = new Set(groups.map((group) => group.date.slice(0, 4))).size > 1

  return (
    <div className={cn("-mx-4 flex flex-col", className)}>
      {groups.map((group) => (
        <section key={group.date} className="border-b">
          <DayHeader
            date={group.date}
            totalLabel={formatKRW(group.total)}
            showMonth={spansMonths}
            showYear={spansYears}
            stickyTopClassName={DAY_STICKY_TOP}
          />
          {group.rows.map((row) => {
            const note = rowNote(row)
            const payment = carEntryPaymentLabel(row.entry, row.installmentNo)
            return (
              <EntryLink
                key={row.key}
                entry={row.entry}
                className="flex items-start gap-3 border-t px-4 py-2.5 first:border-t-0 hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug font-medium break-keep wrap-anywhere">{rowTitle(row)}</p>
                  {note || row.diffKm != null ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {row.diffKm != null ? (
                        <span className="font-medium text-blue-600 tabular-nums dark:text-blue-400">
                          {row.diffKm >= 0 ? "+" : ""}
                          {formatKm(row.diffKm)}
                          {note ? " · " : ""}
                        </span>
                      ) : null}
                      {note}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-sm font-semibold tabular-nums">
                    {row.amount !== null ? formatKRW(row.amount) : "-"}
                  </span>
                  {payment ? <span className="text-xs text-muted-foreground">{payment}</span> : null}
                </div>
              </EntryLink>
            )
          })}
        </section>
      ))}
    </div>
  )
}
