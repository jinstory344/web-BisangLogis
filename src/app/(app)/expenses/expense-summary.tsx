import { SummaryMonthNav } from "@/components/list/summary-month-nav"
import { EXPENSE_CATEGORIES } from "@/lib/constants/expense-categories"
import { formatYearMonth, getMonthRange, shiftMonthRange } from "@/lib/date"
import { formatKRW } from "@/lib/money"
import { formatChangeRate } from "@/lib/summary"
import { createClient } from "@/lib/supabase/server"

/** 지출 월간 집계 탭: 목록 탭에서 보고 있는 달(from이 속한 달)을 집계한다. */
export async function ExpenseSummary({ from }: { from: string }) {
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

  const majorTotals = new Map<string, number>()
  const minorTotals = new Map<string, Map<string, number>>()
  for (const row of rows) {
    majorTotals.set(
      row.category_major,
      (majorTotals.get(row.category_major) ?? 0) + row.amount
    )
    if (!minorTotals.has(row.category_major)) {
      minorTotals.set(row.category_major, new Map())
    }
    const minorMap = minorTotals.get(row.category_major)!
    minorMap.set(
      row.category_minor,
      (minorMap.get(row.category_minor) ?? 0) + row.amount
    )
  }

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

      <div className="rounded-md border">
        {EXPENSE_CATEGORIES.map(({ major, minors }) => {
          const majorTotal = majorTotals.get(major) ?? 0
          const majorPct =
            grandTotal > 0 ? Math.round((majorTotal / grandTotal) * 100) : 0
          const minorMap = minorTotals.get(major)

          return (
            <div key={major} className="border-b last:border-0">
              <div className="flex items-center justify-between p-3 font-medium">
                <span>{major}</span>
                <span>
                  {formatKRW(majorTotal)}{" "}
                  <span className="text-sm text-muted-foreground">
                    ({majorPct}%)
                  </span>
                </span>
              </div>
              {minorMap && minorMap.size > 0 ? (
                <div className="flex flex-col gap-1 px-3 pb-3 pl-6">
                  {minors
                    .filter((minor) => minorMap.has(minor))
                    .map((minor) => {
                      const minorTotal = minorMap.get(minor) ?? 0
                      const minorPct =
                        grandTotal > 0
                          ? Math.round((minorTotal / grandTotal) * 100)
                          : 0
                      return (
                        <div
                          key={minor}
                          className="flex items-center justify-between text-sm text-muted-foreground"
                        >
                          <span>{minor}</span>
                          <span>
                            {formatKRW(minorTotal)} ({minorPct}%)
                          </span>
                        </div>
                      )
                    })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
