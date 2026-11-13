import { formatKRW } from "@/lib/money"
import {
  formatMonthBucketLabel,
  formatWeekBucketLabel,
  type LedgerView,
  type RangeBucket,
} from "@/lib/ledger"
import { cn } from "@/lib/utils"

import { EXPENSE_TEXT_CLASS, INCOME_TEXT_CLASS, netTextClass } from "./colors"

function bucketLabel(view: LedgerView, bucket: RangeBucket): string {
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
    // 상자 없이 화면 폭을 꽉 채운 줄 목록
    <div className="-mx-4 divide-y border-b md:mx-0">
      {buckets.map((bucket) => {
        const isEmpty = bucket.count === 0
        return (
          <div
            key={bucket.key}
            className={cn(
              "px-4 py-2.5",
              isEmpty && "text-muted-foreground"
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">
                {bucketLabel(view, bucket)}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {bucket.count}건
                </span>
              </span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  isEmpty ? "text-muted-foreground" : netTextClass(bucket.net)
                )}
              >
                {formatKRW(bucket.net)}
              </span>
            </div>
            {isEmpty ? null : (
              <div className="mt-1 flex gap-4 text-xs tabular-nums">
                <span className={INCOME_TEXT_CLASS}>
                  매출 {formatKRW(bucket.income)}
                </span>
                <span className={EXPENSE_TEXT_CLASS}>
                  지출 {formatKRW(bucket.expense)}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
