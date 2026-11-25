import Link from "next/link"
import type { ReactNode } from "react"

import {
  CalendarAmount,
  CalendarDayNumber,
  CalendarGrid,
  calendarCellClass,
} from "@/components/ledger/calendar-grid"
import { bucketLabel } from "@/components/ledger/ledger-range-list"
import { PeriodRangeList, type PeriodRangeItem } from "@/components/ledger/period-range-list"
import {
  bucketTarget,
  buildDailySums,
  buildPeriodBuckets,
  listViewHref,
  type ListParams,
  type ListView,
  type MetricRow,
  type PeriodSums,
} from "@/lib/period-view"

export interface CalendarLine {
  /** 칸이 좁아 "원" 없이 숫자만 (예: "125,000" / "3건") */
  text: string
  className?: string
}

export type RangeRowView = Pick<PeriodRangeItem, "value" | "valueClassName" | "details" | "countText">

/**
 * 매출·지출·배차·차계부의 달력·주별·월별·연별 보기 본문 (HOME 장부와 같은 모양).
 * - 달력: 날짜 칸마다 그날 합계, 칸을 누르면 그날만 일일 목록. 달력 아래에 그 달 집계 카드.
 * - 주별: 그 달의 주차마다 합계 줄, 누르면 그 주 일일 목록.
 * - 월별: 위에 그 해 집계 카드 + 1~12월 줄, 누르면 그 달 일일 목록.
 * - 연별: 위에 전체 기간 집계 카드 + 해마다 줄, 누르면 그 해 월별.
 * 금액 줄(rows)은 이미 거르기가 적용된 것이어야 한다 — 칸 합계와 위 합계 줄이 같은 줄에서 나온다.
 */
export function ListPeriodView<K extends string>({
  view,
  anchor,
  today,
  pathname,
  params,
  rows,
  keys,
  cellLines,
  rowView,
  summaryCard,
}: {
  view: Exclude<ListView, "day">
  anchor: string
  today: string
  pathname: string
  /** 지금 주소 값 (거르기 유지용) */
  params: ListParams
  rows: readonly MetricRow<K>[]
  keys: readonly K[]
  /** 달력 칸 안 줄들 */
  cellLines: (sums: PeriodSums<K>) => CalendarLine[]
  /** 주별·월별·연별 줄 하나의 금액 부분 */
  rowView: (sums: PeriodSums<K>) => RangeRowView
  /** 집계 카드 (달력: 그 달, 월별: 그 해, 연별: 전체). 주별에는 없음 */
  summaryCard?: ReactNode
}) {
  if (view === "calendar") {
    const byDate = buildDailySums(rows, keys)
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col">
          <CalendarGrid
            anchor={anchor}
            today={today}
            renderCell={(cell) => {
              const sums = cell.inMonth ? byDate[cell.date] : undefined
              const label = `${Number(cell.date.slice(5, 7))}월 ${cell.day}일`
              const content = (
                <>
                  <CalendarDayNumber cell={cell} />
                  {sums ? (
                    <span className="flex flex-col items-end text-right">
                      {cellLines(sums).map((line, index) => (
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
              return (
                <Link
                  key={cell.date}
                  href={listViewHref(pathname, params, bucketTarget(view, { from: cell.date, to: cell.date }))}
                  prefetch={false}
                  aria-label={label}
                  className={`${calendarCellClass(cell)} active:bg-muted md:hover:bg-muted/50`}
                >
                  {content}
                </Link>
              )
            }}
          />
        </div>
        {summaryCard}
      </div>
    )
  }

  const items: PeriodRangeItem[] = buildPeriodBuckets(view, anchor, rows, keys, today).map((bucket) => ({
    key: bucket.key,
    label: bucketLabel(view, bucket),
    isEmpty: bucket.count === 0,
    href: listViewHref(pathname, params, bucketTarget(view, bucket)),
    ...rowView(bucket),
  }))

  return (
    <div className="flex flex-col gap-4">
      {summaryCard}
      <PeriodRangeList items={items} />
    </div>
  )
}
