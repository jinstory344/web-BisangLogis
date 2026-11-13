"use client"

import { useState } from "react"

import { DayHeader } from "@/components/list/day-header"
import { formatKRW } from "@/lib/money"
import type { DayBucket } from "@/lib/ledger"
import { spansMultipleMonths } from "@/lib/day-groups"
import { cn } from "@/lib/utils"

import type { DayLedgerEntry } from "@/app/(app)/ledger-data"

import { EXPENSE_TEXT_CLASS, INCOME_TEXT_CLASS } from "./colors"
import { LedgerEntryActions } from "./ledger-entry-actions"

/**
 * 일일 장부: 날짜별로 그날의 매출(파랑)과 지출(빨강)을 한 목록에 보여 준다.
 * 날짜 머리글에는 그날 매출·지출 합계가 있고, 건을 누르면 매출·지출 목록과 같은 작업 시트가 뜬다
 * (매출: 입금 처리·상세·수정·복사 등록·삭제 / 지출: 수정·복사 등록·삭제).
 */
export function LedgerDayList({
  buckets,
  emptyMessage = "이 달에 기록된 매출·지출이 없습니다.",
}: {
  buckets: DayBucket<DayLedgerEntry>[]
  emptyMessage?: string
}) {
  const [sheetEntry, setSheetEntry] = useState<DayLedgerEntry | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  if (buckets.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    )
  }

  const spansMonths = spansMultipleMonths(buckets)

  return (
    // 상자 없이 화면 폭을 꽉 채운 줄 목록 (가계부 앱의 일일 화면처럼)
    <div className="-mx-4 flex flex-col md:mx-0">
      {buckets.map((bucket) => (
        <section key={bucket.date} className="border-b">
          <DayHeader
            date={bucket.date}
            showMonth={spansMonths}
            totalLabel={
              // 매출(파랑)과 지출(빨강) 사이를 넉넉히 띄운다
              <span className="flex items-center gap-5">
                {bucket.income > 0 ? (
                  <span className={INCOME_TEXT_CLASS}>
                    {formatKRW(bucket.income)}
                  </span>
                ) : null}
                {bucket.expense > 0 ? (
                  <span className={EXPENSE_TEXT_CLASS}>
                    {formatKRW(bucket.expense)}
                  </span>
                ) : null}
              </span>
            }
          />

          {bucket.entries.map((entry) => (
            <button
              type="button"
              key={`${entry.kind}-${entry.id}`}
              onClick={() => {
                setSheetEntry(entry)
                setIsSheetOpen(true)
              }}
              className="flex w-full items-start gap-3 border-t px-4 py-2.5 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
            >
              {entry.kind === "sale" ? (
                <>
                  <div className="w-16 shrink-0 truncate pt-0.5 text-xs leading-snug text-muted-foreground">
                    {entry.source}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug font-medium break-keep wrap-anywhere">
                      {entry.route}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      매출 · {entry.sourceMajor}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        INCOME_TEXT_CLASS
                      )}
                    >
                      {formatKRW(entry.amount)}
                    </span>
                    {entry.isUnpaid ? (
                      <span className="text-xs font-medium text-destructive">
                        미입금
                      </span>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 shrink-0 truncate pt-0.5 text-xs leading-snug text-muted-foreground">
                    {entry.major}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug font-medium break-keep wrap-anywhere">
                      {entry.minor}
                    </p>
                    {entry.note ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {entry.note}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        EXPENSE_TEXT_CLASS
                      )}
                    >
                      {formatKRW(entry.amount)}
                    </span>
                    {entry.paymentLabel ? (
                      <span className="text-xs text-muted-foreground">
                        {entry.paymentLabel}
                      </span>
                    ) : null}
                  </div>
                </>
              )}
            </button>
          ))}
        </section>
      ))}

      <LedgerEntryActions
        entry={sheetEntry}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
      />
    </div>
  )
}
