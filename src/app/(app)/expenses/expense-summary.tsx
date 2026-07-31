import { EXPENSE_CATEGORIES } from "@/lib/constants/expense-categories"
import {
  getCurrentMonthRangeInSeoul,
  getPreviousMonthRangeInSeoul,
} from "@/lib/date"
import { formatKRW } from "@/lib/money"
import { createClient } from "@/lib/supabase/server"

function formatChangeRate(current: number, previous: number): string {
  if (previous === 0) {
    return current === 0 ? "전월과 동일" : "전월 지출 없음"
  }
  const rate = Math.round(((current - previous) / previous) * 100)
  if (rate === 0) return "전월과 동일"
  return rate > 0 ? `전월 대비 +${rate}%` : `전월 대비 ${rate}%`
}

export async function ExpenseSummary() {
  const supabase = await createClient()
  const current = getCurrentMonthRangeInSeoul()
  const previous = getPreviousMonthRangeInSeoul()

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
      <div className="rounded-md border p-4">
        <p className="text-sm text-muted-foreground">이번 달 지출 합계</p>
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
