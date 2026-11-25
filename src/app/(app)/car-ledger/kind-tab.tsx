import { entryRowsInRange, type CarEntry } from "@/lib/car-ledger/entries"
import type { DateRange } from "@/lib/date"

import { EntryDayList } from "./entry-day-list"

/** 주유·요소수(·세차·추가 종류) 탭: 그 달 기록을 지출 목록 같은 날짜별 줄로 (리터·단가는 줄 아래 작은 글씨) */
export function KindTab({
  kind,
  entries,
  month,
}: {
  kind: string
  /** 이 종류 기록 */
  entries: CarEntry[]
  month: DateRange
}) {
  return (
    <EntryDayList
      className="-mt-3"
      rows={entryRowsInRange(entries, month.from, month.to)}
      emptyMessage={`이 달에 ${kind} 기록이 없어요.`}
    />
  )
}
