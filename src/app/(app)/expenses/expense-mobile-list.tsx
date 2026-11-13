"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { DayHeader } from "@/components/list/day-header"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { EXPENSE_PAYMENT_METHOD_LABELS } from "@/lib/constants/payment-method"
import { formatDateWithWeekday } from "@/lib/date"
import { groupByDay, spansMultipleMonths } from "@/lib/day-groups"
import { formatKRW } from "@/lib/money"
import type { ExpenseRow } from "@/lib/supabase/database.types"

interface ExpenseMobileListProps {
  expenses: ExpenseRow[]
  /** 대분류·소분류 필터에 맞는 전체 건수와 합계 (페이지가 아니라 필터 전체 기준) */
  count: number
  total: number
  /** 필터가 걸려 있을 때만 목록 위에 합계를 보여 준다 (아니면 상단 요약 카드와 같은 숫자). */
  isFiltered: boolean
  onDelete: (expense: ExpenseRow) => void
}

/** 결제수단과 할부: "카드 · 3개월 할부" (할부가 없으면 결제수단만) */
function paymentSummary(expense: ExpenseRow): string {
  const method = expense.payment_method
    ? EXPENSE_PAYMENT_METHOD_LABELS[expense.payment_method]
    : ""
  // 할부는 카드일 때만 표시한다 (카드가 아닌데 값이 남아 있는 옛 데이터는 숨긴다).
  const installment =
    expense.payment_method === "CARD" &&
    expense.installment_months &&
    expense.installment_months > 1
      ? `${expense.installment_months}개월 할부`
      : ""
  return [method, installment].filter(Boolean).join(" · ")
}

/** 행 둘째 줄: 사용처와 비고를 한 줄로 */
function noteLine(expense: ExpenseRow): string {
  return [expense.vendor, expense.memo]
    .map((text) => text?.trim())
    .filter(Boolean)
    .join(" · ")
}

/**
 * 모바일 지출 목록: 날짜별 묶음 + 한 건당 두 줄 행(대분류 · 소분류/사용처·비고 · 금액/결제수단).
 * 행에는 버튼이 없고, 행을 누르면 열리는 작업 시트에서 수정·복사 등록·삭제를 한다.
 */
export function ExpenseMobileList({
  expenses,
  count,
  total,
  isFiltered,
  onDelete,
}: ExpenseMobileListProps) {
  const groups = useMemo(
    () =>
      groupByDay(
        expenses,
        (expense) => expense.expense_date,
        (expense) => expense.amount
      ),
    [expenses]
  )
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const spansMonths = spansMultipleMonths(groups)
  const sheetExpense = expenses.find((expense) => expense.id === sheetId) ?? null

  function openSheet(expense: ExpenseRow) {
    setSheetId(expense.id)
    setIsSheetOpen(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex min-h-9 items-center text-xs text-muted-foreground">
        {count}건{isFiltered ? ` · 합계 ${formatKRW(total)}` : ""}
      </p>

      {groups.map((group) => (
        <section key={group.date} className="-mx-4 -mt-3 overflow-hidden border-b">
          <DayHeader
            date={group.date}
            totalLabel={formatKRW(group.total)}
            showMonth={spansMonths}
          />

          {group.rows.map((expense) => {
            const note = noteLine(expense)
            const payment = paymentSummary(expense)
            return (
              <div
                key={expense.id}
                className="relative flex items-start gap-3 border-t px-4 py-2.5 first:border-t-0"
              >
                {/* 행 전체가 눌리는 영역(누르면 작업 시트). 안쪽 글자는 클릭을 그대로 통과시킨다. */}
                <button
                  type="button"
                  aria-label={`${expense.category_major} ${expense.category_minor}, ${formatKRW(expense.amount)}`}
                  className="absolute inset-0 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/60"
                  onClick={() => openSheet(expense)}
                />

                <div className="pointer-events-none w-16 shrink-0 truncate pt-0.5 text-xs leading-snug text-muted-foreground">
                  {expense.category_major}
                </div>

                <div className="pointer-events-none min-w-0 flex-1">
                  <p className="text-sm leading-snug font-medium break-keep wrap-anywhere">
                    {expense.category_minor}
                  </p>
                  {note ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {note}
                    </p>
                  ) : null}
                </div>

                <div className="pointer-events-none flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatKRW(expense.amount)}
                  </span>
                  {payment ? (
                    <span className="text-xs text-muted-foreground">
                      {payment}
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </section>
      ))}

      <Sheet
        open={isSheetOpen && sheetExpense !== null}
        onOpenChange={setIsSheetOpen}
      >
        <SheetContent side="bottom" className="gap-0 pb-6">
          {sheetExpense ? (
            <ExpenseActionSheetBody
              expense={sheetExpense}
              onDelete={() => {
                setIsSheetOpen(false)
                onDelete(sheetExpense)
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

export function ExpenseActionSheetBody({
  expense,
  onDelete,
}: {
  expense: ExpenseRow
  onDelete: () => void
}) {
  const payment = paymentSummary(expense)
  const details = [
    { label: "결제수단", value: payment },
    { label: "사용처", value: expense.vendor?.trim() ?? "" },
    { label: "세금계산서", value: expense.has_tax_invoice ? "받음" : "" },
    { label: "비고", value: expense.memo?.trim() ?? "" },
  ].filter((detail) => detail.value)

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle className="leading-snug break-keep wrap-anywhere">
          {expense.category_major} · {expense.category_minor}
        </SheetTitle>
        <SheetDescription>
          {formatDateWithWeekday(expense.expense_date)}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-3 px-4">
        <p className="rounded-lg bg-muted/50 p-3 text-center text-xl font-semibold tabular-nums">
          {formatKRW(expense.amount)}
        </p>

        {details.length > 0 ? (
          <dl className="flex flex-col gap-1.5 text-sm">
            {details.map((detail) => (
              <div key={detail.label} className="flex gap-3">
                <dt className="w-16 shrink-0 text-muted-foreground">
                  {detail.label}
                </dt>
                <dd className="min-w-0 flex-1 break-words whitespace-pre-wrap">
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11" asChild>
            <Link href={`/expenses/${expense.id}/edit`} prefetch>수정</Link>
          </Button>
          <Button variant="outline" className="h-11" asChild>
            <Link href={`/expenses/new?copy=${expense.id}`}>복사 등록</Link>
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          className="h-10 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          삭제
        </Button>
      </div>
    </>
  )
}
