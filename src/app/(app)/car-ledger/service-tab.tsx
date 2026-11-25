import { formatEntryDate, formatKm, formatKmNumber } from "@/lib/car-ledger/constants"
import { sortEntriesDesc, type CarEntry } from "@/lib/car-ledger/entries"
import type { ItemHistory } from "@/lib/car-ledger/stats"
import { formatKRW } from "@/lib/money"

import { EntryLink } from "./entry-link"

/**
 * 정비 탭 내용([전체 ▾] 항목 고르기는 탭 줄 밑에 고정되어 page에서 따로 그린다):
 * 항목을 안 골랐으면 그 달 정비 기록 카드, 골랐으면 그 항목의 전체 기간 이력.
 */
export function ServiceTab({
  monthEntries,
  history,
  today,
}: {
  monthEntries: CarEntry[]
  history: ItemHistory | null
  today: string
}) {
  return (
    <div className="flex flex-col gap-3">
      {history ? (
        <ItemHistoryList history={history} today={today} />
      ) : (
        <ServiceCards entries={sortEntriesDesc(monthEntries)} today={today} />
      )}
    </div>
  )
}

function ServiceCards({ entries, today }: { entries: CarEntry[]; today: string }) {
  if (entries.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">이 달에 정비 기록이 없어요.</p>
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {entries.map((entry) => (
        <li key={entry.key} className="overflow-hidden rounded-xl border bg-card">
          <EntryLink entry={entry} className="px-4 py-3">
            <div className="flex items-start gap-3">
              <p className="min-w-0 flex-1 truncate text-sm font-medium">
                {formatEntryDate(entry.date, today)}
                {entry.vendor ? <span className="text-muted-foreground"> · {entry.vendor}</span> : null}
              </p>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{formatKRW(entry.amount)}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>
                {entry.km !== null ? formatKm(entry.km) : "km 없음"}
                {entry.cardName ? ` · 카드 ${entry.cardName}` : ""}
              </span>
              {entry.installmentMonths ? (
                <span className="rounded-full bg-[#3b2f57] px-2 py-0.5 text-[11px] font-medium text-[#d7cbf2]">
                  할부 {entry.installmentMonths}개월
                </span>
              ) : null}
            </div>
            {entry.items.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-0.5 border-t pt-2 text-[13px]">
                {entry.items.map((line, index) => (
                  <li key={`${line.item}-${index}`} className="flex gap-3">
                    <span className="min-w-0 flex-1 truncate">{line.item}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {line.amount !== null ? formatKRW(line.amount) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {entry.memo?.trim() ? (
              <p className="mt-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs whitespace-pre-wrap text-muted-foreground">
                {entry.memo.trim()}
              </p>
            ) : null}
          </EntryLink>
        </li>
      ))}
    </ul>
  )
}

function ItemHistoryList({ history, today }: { history: ItemHistory; today: string }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b bg-muted/30 px-4 py-2.5 text-[13px]">
        <span className="font-semibold">
          {history.item} · {history.count}회
        </span>
        <span className="text-muted-foreground">|</span>
        <span className="text-muted-foreground">
          {history.averageIntervalKm !== null ? `평균 ${formatKmNumber(history.averageIntervalKm)}km마다` : "평균 간격 -"}
          {" · "}합계 {history.total.toLocaleString("ko-KR")}
        </span>
      </div>
      {history.rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">이 항목 기록이 없어요.</p>
      ) : (
        <ul>
          {history.rows.map((row) => (
            <li key={row.entry.key} className="border-t first:border-t-0">
              <EntryLink entry={row.entry} className="px-4 py-2.5">
                <div className="flex items-start gap-3">
                  <p className="min-w-0 flex-1 truncate text-sm">
                    {formatEntryDate(row.entry.date, today)}
                    {row.entry.vendor ? <span className="text-muted-foreground"> · {row.entry.vendor}</span> : null}
                  </p>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {row.amount !== null ? formatKRW(row.amount) : "-"}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs">
                  <span className="min-w-0 flex-1 text-muted-foreground tabular-nums">
                    {row.entry.km !== null ? formatKm(row.entry.km) : "km 없음"}
                  </span>
                  {row.diffKm !== null ? (
                    <span className="shrink-0 font-medium text-blue-600 tabular-nums dark:text-blue-400">
                      {row.diffKm >= 0 ? "+" : ""}
                      {formatKm(row.diffKm)}
                    </span>
                  ) : null}
                </div>
              </EntryLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
