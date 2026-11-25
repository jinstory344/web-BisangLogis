import { formatKRW } from "@/lib/money"
import {
  formatMonthBucketLabel,
  formatWeekBucketLabel,
  type LedgerView,
  type RangeBucket,
} from "@/lib/ledger"

import { EXPENSE_TEXT_CLASS, INCOME_TEXT_CLASS, netTextClass } from "./colors"
import { PeriodRangeList } from "./period-range-list"

export function bucketLabel(view: LedgerView, bucket: Pick<RangeBucket, "key" | "from" | "to">): string {
  if (view === "week") return formatWeekBucketLabel(bucket)
  if (view === "month") return formatMonthBucketLabel(bucket)
  return `${bucket.key}년`
}

/**
 * 주별·월별·연별 장부: 기간마다 한 줄 — 이름, 건수, 매출(파랑) / 지출(빨강) / 합계.
 * 기록이 없는 기간은 흐리게 보여서 어느 달·해가 비었는지 알 수 있다.
 */
export function LedgerRangeList({
  view,
  buckets,
}: {
  view: LedgerView
  buckets: RangeBucket[]
}) {
  return (
    <PeriodRangeList
      items={buckets.map((bucket) => ({
        key: bucket.key,
        label: bucketLabel(view, bucket),
        countText: `${bucket.count}건`,
        value: formatKRW(bucket.net),
        valueClassName: netTextClass(bucket.net),
        isEmpty: bucket.count === 0,
        details: [
          { text: `매출 ${formatKRW(bucket.income)}`, className: INCOME_TEXT_CLASS },
          { text: `지출 ${formatKRW(bucket.expense)}`, className: EXPENSE_TEXT_CLASS },
        ],
      }))}
    />
  )
}
