import { formatKmNumber } from "@/lib/car-ledger/constants"
import { entryRowsInRange, type CarEntry } from "@/lib/car-ledger/entries"
import type { ItemHistory } from "@/lib/car-ledger/stats"
import type { DateRange } from "@/lib/date"
import { formatKRW } from "@/lib/money"

import { EntryDayList } from "./entry-day-list"

/**
 * 정비 탭 내용([전체 ▾] 항목 고르기는 탭 줄 밑에 고정되어 page에서 따로 그린다):
 * 항목을 안 골랐으면 그 달 정비 기록, 골랐으면 그 항목의 전체 기간 이력 — 둘 다 지출 목록 같은 날짜별 줄.
 */
export function ServiceTab({
  monthEntries,
  month,
  history,
}: {
  monthEntries: CarEntry[]
  month: DateRange
  history: ItemHistory | null
}) {
  if (history) return <ItemHistoryList history={history} />
  return (
    <EntryDayList
      className="-mt-3"
      rows={entryRowsInRange(monthEntries, month.from, month.to)}
      emptyMessage="이 달에 정비 기록이 없어요."
    />
  )
}

/** 고른 항목의 전체 이력: 한 줄 요약(횟수·평균 간격·합계) + 날짜별 줄(직전 기록과의 km 차이) */
function ItemHistoryList({ history }: { history: ItemHistory }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-muted-foreground">
        <span className="font-semibold text-foreground">
          {history.item} {history.count}회
        </span>
        {" · "}
        {history.averageIntervalKm !== null ? `평균 ${formatKmNumber(history.averageIntervalKm)}km마다` : "평균 간격 -"}
        {" · "}합계 {formatKRW(history.total)}
      </p>
      <EntryDayList
        rows={history.rows.map((row) => ({
          key: row.entry.key,
          entry: row.entry,
          date: row.entry.date,
          amount: row.amount,
          installmentNo: null,
          diffKm: row.diffKm,
        }))}
        emptyMessage="이 항목 기록이 없어요."
      />
    </div>
  )
}
