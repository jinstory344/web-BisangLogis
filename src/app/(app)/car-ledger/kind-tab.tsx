import { formatEntryDate, formatKmNumber, unitPrice } from "@/lib/car-ledger/constants"
import { sortEntriesDesc, type CarEntry } from "@/lib/car-ledger/entries"
import { kindSummary } from "@/lib/car-ledger/stats"
import type { DateRange } from "@/lib/date"
import { formatLiters } from "@/lib/fuel"
import { formatKRW } from "@/lib/money"

import { EntryLink } from "./entry-link"

/**
 * 주유·요소수(·세차·추가 종류) 탭: 위 카드 2개(이달 횟수·합계 / 리터·평균 단가) + 기록 줄.
 * 리터 없는 종류(세차 등)는 둘째 카드 없이, 줄 둘째 칸에 장소·비고를 보여 준다.
 */
export function KindTab({
  kind,
  entries,
  month,
  showLiters,
  today,
}: {
  kind: string
  /** 이 달, 이 종류 기록 */
  entries: CarEntry[]
  month: DateRange
  showLiters: boolean
  today: string
}) {
  const summary = kindSummary(entries, kind, month.from, month.to)
  const monthLabel = `${Number(month.from.slice(5, 7))}월`
  const rows = sortEntriesDesc(entries)

  return (
    <div className="flex flex-col gap-3">
      <div className={showLiters ? "grid grid-cols-2 gap-2" : "grid grid-cols-1"}>
        <div className="rounded-xl border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {monthLabel} {kind} · {summary.count}회
          </p>
          <p className="mt-0.5 text-lg font-bold tabular-nums">{formatKRW(summary.total)}</p>
        </div>
        {showLiters ? (
          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">리터 · 평균 단가</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">
              {summary.liters > 0 ? formatLiters(summary.liters) : "-"}
              <span className="text-sm font-medium text-muted-foreground">
                {" · "}
                {summary.unitPrice !== null ? formatKRW(summary.unitPrice) : "-"}
              </span>
            </p>
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">이 달에 {kind} 기록이 없어요.</p>
      ) : (
        <ul className="overflow-hidden rounded-xl border bg-card">
          {rows.map((entry) => {
            const price = unitPrice(entry.amount, entry.liters)
            const second = showLiters
              ? entry.liters !== null
                ? `${formatLiters(entry.liters)}${price !== null ? ` · ${price.toLocaleString("ko-KR")}원/L` : ""}`
                : "리터 없음"
              : [entry.vendor, entry.memo].map((text) => text?.trim()).filter(Boolean).join(" · ")
            const km = entry.km !== null ? `${formatKmNumber(entry.km)}km` : null
            return (
              <li key={entry.key} className="border-t first:border-t-0">
                <EntryLink entry={entry} className="px-4 py-2.5">
                  <div className="flex items-start gap-3">
                    <p className="min-w-0 flex-1 truncate text-sm">
                      {formatEntryDate(entry.date, today)}
                      {showLiters && entry.vendor ? (
                        <span className="text-muted-foreground"> · {entry.vendor}</span>
                      ) : null}
                    </p>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{formatKRW(entry.amount)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="min-w-0 flex-1 truncate tabular-nums">
                      {[second, km].filter(Boolean).join(" · ")}
                    </span>
                    {entry.cardName ? <span className="shrink-0">{entry.cardName}</span> : null}
                  </div>
                </EntryLink>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
