import { DonutChart } from "@/components/stats/donut-chart"
import { SummaryMonthNav } from "@/components/list/summary-month-nav"
import type { ExpenseCategoryTree } from "@/lib/constants/expense-categories"
import { formatYearMonth, getMonthRange, shiftMonthRange } from "@/lib/date"
import { buildMonthBreakdown } from "@/lib/expense-list"
import { formatKRW } from "@/lib/money"
import { formatChangeRate, percentOf } from "@/lib/summary"
import { createClient } from "@/lib/supabase/server"

/**
 * 지출 월간 집계 탭: 목록 탭에서 보고 있는 달(from이 속한 달)을 집계한다.
 * 대분류·소분류는 분류 목록(DB) 순서로 보여 주고, 목록에 없는 값(직접 입력한 소분류, 지운 분류)도
 * 빠뜨리지 않고 뒤에 붙인다.
 */
export async function ExpenseSummary({
  from,
  categories,
}: {
  from: string
  categories: ExpenseCategoryTree
}) {
  const supabase = await createClient()
  const current = getMonthRange(from)
  const previous = shiftMonthRange(from, -1)

  const [{ data: currentRows, error: currentError }, { data: previousRows }] =
    await Promise.all([
      supabase
        .from("expenses")
        .select("category_major, category_minor, amount")
        .is("deleted_at", null)
        .gte("expense_date", current.from)
        .lte("expense_date", current.to),
      supabase
        .from("expenses")
        .select("amount")
        .is("deleted_at", null)
        .gte("expense_date", previous.from)
        .lte("expense_date", previous.to),
    ])

  if (currentError) {
    return (
      <p className="text-sm text-destructive">
        월간 집계를 불러오지 못했습니다: {currentError.message}
      </p>
    )
  }

  const rows = currentRows ?? []
  const grandTotal = rows.reduce((sum, r) => sum + r.amount, 0)
  const previousTotal = (previousRows ?? []).reduce(
    (sum, r) => sum + r.amount,
    0
  )
  const breakdown = buildMonthBreakdown(categories, rows)

  return (
    <div className="flex flex-col gap-4">
      <SummaryMonthNav from={current.from} to={current.to} />

      <div className="rounded-md border p-4">
        <p className="text-sm text-muted-foreground">
          {formatYearMonth(current.from)} 지출 합계
        </p>
        <p className="text-2xl font-semibold">{formatKRW(grandTotal)}</p>
        <p className="text-sm text-muted-foreground">
          {formatChangeRate(grandTotal, previousTotal)} (지난 달{" "}
          {formatKRW(previousTotal)})
        </p>
      </div>

      <DonutChart
        ariaLabel="지출 대분류별 비율"
        items={breakdown.map(({ major, total }) => ({ label: major, value: total }))}
      />

      <div className="rounded-md border">
        {breakdown.map(({ major, total, minors }) => (
          <div key={major} className="border-b last:border-0">
            <div className="flex items-center justify-between p-3 font-medium">
              <span>{major}</span>
              <span>
                {formatKRW(total)}{" "}
                <span className="text-sm text-muted-foreground">
                  ({percentOf(total, grandTotal)}%)
                </span>
              </span>
            </div>
            {minors.length > 0 ? (
              <div className="flex flex-col gap-1 px-3 pb-3 pl-6">
                {minors.map(({ minor, total: minorTotal }) => (
                  <div
                    key={minor}
                    className="flex items-center justify-between text-sm text-muted-foreground"
                  >
                    <span>{minor}</span>
                    <span>
                      {formatKRW(minorTotal)} ({percentOf(minorTotal, grandTotal)}%)
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
