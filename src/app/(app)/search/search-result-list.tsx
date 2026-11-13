import Link from "next/link"
import type { ReactNode } from "react"

import { EXPENSE_TEXT_CLASS, INCOME_TEXT_CLASS } from "@/components/ledger/colors"
import { formatKRW } from "@/lib/money"
import { formatSearchDate } from "@/lib/search"
import { cn } from "@/lib/utils"

import type { DayLedgerEntry } from "../ledger-data"

import type { SearchDispatch } from "./search-data"

/**
 * 검색 결과 목록 (가계부 앱의 검색 화면처럼): 상자 없이 화면 폭을 꽉 채운 얇은 줄들.
 * 한 줄 = 왼쪽(연도까지 날짜 · 분류) / 가운데(내용 · 보조 글) / 오른쪽(금액).
 * 날짜별로 묶지 않고 최근 날짜부터 줄줄이 보여 줘서 한 화면에 많이 보인다.
 */
function ResultRow({
  href,
  date,
  side,
  title,
  sub,
  amount,
  amountClassName,
  note,
}: {
  href: string
  date: string
  side: string
  title: string
  sub: string
  amount: string
  amountClassName?: string
  note?: ReactNode
}) {
  return (
    <li>
      <Link
        href={href}
        prefetch
        className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40 active:bg-muted/60"
      >
        <div className="w-[4.75rem] shrink-0 text-xs leading-snug text-muted-foreground">
          <p className="tabular-nums">{formatSearchDate(date)}</p>
          <p className="mt-0.5 truncate">{side}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-snug font-medium">{title}</p>
          {sub ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className={cn("text-sm font-semibold tabular-nums", amountClassName)}>
            {amount}
          </span>
          {note}
        </div>
      </Link>
    </li>
  )
}

function EmptyMessage({ children }: { children: ReactNode }) {
  return (
    <p className="py-12 text-center text-sm text-muted-foreground">{children}</p>
  )
}

const LIST_CLASS = "-mx-4 -mt-3 divide-y md:mx-0"

/** 최근 날짜부터, 같은 날이면 최근 등록부터 */
function byRecent(a: DayLedgerEntry, b: DayLedgerEntry): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
}

/** 찾은 매출(파랑)·지출(빨강). 매출은 상세로, 지출은 수정 화면으로 간다. */
export function SearchLedgerList({
  entries,
  emptyMessage,
}: {
  entries: DayLedgerEntry[]
  emptyMessage: string
}) {
  if (entries.length === 0) return <EmptyMessage>{emptyMessage}</EmptyMessage>

  return (
    <ul className={LIST_CLASS}>
      {[...entries].sort(byRecent).map((entry) =>
        entry.kind === "sale" ? (
          <ResultRow
            key={`sale-${entry.id}`}
            href={`/sales/${entry.id}`}
            date={entry.date}
            side={entry.source}
            title={entry.route}
            sub={`매출 · ${entry.sourceMajor}`}
            amount={formatKRW(entry.amount)}
            amountClassName={INCOME_TEXT_CLASS}
            note={
              entry.isUnpaid ? (
                <span className="text-xs font-medium text-destructive">미입금</span>
              ) : null
            }
          />
        ) : (
          <ResultRow
            key={`expense-${entry.id}`}
            href={`/expenses/${entry.id}/edit`}
            date={entry.date}
            side={entry.major}
            title={entry.minor}
            sub={entry.note}
            amount={formatKRW(entry.amount)}
            amountClassName={EXPENSE_TEXT_CLASS}
            note={
              entry.paymentLabel ? (
                <span className="text-xs text-muted-foreground">
                  {entry.paymentLabel}
                </span>
              ) : null
            }
          />
        )
      )}
    </ul>
  )
}

/** "12가3456 · 김기사" (차량을 아직 정하지 않았으면 "차량 미정") */
function vehicleLine(dispatch: SearchDispatch): string {
  const text = [dispatch.plate_no_snapshot, dispatch.driver_name_snapshot]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ")
  return text || "차량 미정"
}

/** 찾은 배차 (조회가 이미 최근 날짜순). 누르면 배차 상세로 간다. */
export function SearchDispatchList({
  dispatches,
  clientNameMap,
  emptyMessage,
}: {
  dispatches: SearchDispatch[]
  clientNameMap: Record<string, string>
  emptyMessage: string
}) {
  if (dispatches.length === 0) return <EmptyMessage>{emptyMessage}</EmptyMessage>

  return (
    <ul className={LIST_CLASS}>
      {dispatches.map((dispatch) => (
        <ResultRow
          key={dispatch.id}
          href={`/dispatches/${dispatch.id}`}
          date={dispatch.dispatch_date}
          side={dispatch.client_id ? (clientNameMap[dispatch.client_id] ?? "-") : "-"}
          title={`${dispatch.origin} → ${dispatch.destination}`}
          sub={vehicleLine(dispatch)}
          amount={
            dispatch.freight_amount != null ? formatKRW(dispatch.freight_amount) : "-"
          }
          note={
            dispatch.fee_amount > 0 ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                수수료 {formatKRW(dispatch.fee_amount)}
              </span>
            ) : null
          }
        />
      ))}
    </ul>
  )
}
