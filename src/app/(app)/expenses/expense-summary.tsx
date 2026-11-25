import { DonutChart } from "@/components/stats/donut-chart"
import type { ExpenseCategoryTree } from "@/lib/constants/expense-categories"
import { formatYearMonth, getMonthRange, shiftMonthRange } from "@/lib/date"
import { buildMonthBreakdown } from "@/lib/expense-list"
import { formatLiters, FUEL_MAJOR, FUEL_MINORS, summarizeLiters, type LiterSummary } from "@/lib/fuel"
import { formatKRW } from "@/lib/money"
import { formatChangeRate, percentOf, SUMMARY_TITLE_CLASS, type SummaryComparison } from "@/lib/summary"
import { createClient } from "@/lib/supabase/server"

export interface ExpenseSummaryRow {
  category_major: string
  category_minor: string
  amount: number
}

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

  const [{ data: currentRows, error: currentError }, { data: previousRows }, liters] =
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
      loadMonthLiters(supabase, current.from),
    ])

  if (currentError) {
    return (
      <p className="text-sm text-destructive">
        월간 집계를 불러오지 못했습니다: {currentError.message}
      </p>
    )
  }

  return (
    <ExpenseSummaryCard
      title={formatYearMonth(current.from)}
      rows={currentRows ?? []}
      categories={categories}
      previous={{
        label: "지난 달",
        rateWord: "전월",
        total: (previousRows ?? []).reduce((sum, r) => sum + r.amount, 0),
      }}
      liters={liters}
    />
  )
}

/** 주유비·요소수 리터: 그 달 합 · 최근 12개월(그 달 포함) 중 적은 달의 월 평균 */
export async function loadMonthLiters(
  supabase: Awaited<ReturnType<typeof createClient>>,
  monthFrom: string
): Promise<LiterSummary[]> {
  const current = getMonthRange(monthFrom)
  const yearAgo = shiftMonthRange(monthFrom, -11)
  const { data } = await supabase
    .from("expenses")
    .select("expense_date, category_minor, liters")
    .is("deleted_at", null)
    .eq("category_major", FUEL_MAJOR)
    .in("category_minor", [...FUEL_MINORS])
    .not("liters", "is", null)
    .gte("expense_date", yearAgo.from)
    .lte("expense_date", current.to)
  return summarizeLiters(data ?? [], current.from)
}

/**
 * 지출 집계 카드(통계 화면·지출 달력/월별/연별 보기): 합계 · 비교 · (달 집계면) 리터 · 대분류 도넛 · 대분류 → 소분류 목록.
 */
export function ExpenseSummaryCard({
  title,
  rows,
  categories,
  previous,
  liters = null,
}: {
  /** "2026년 11월" / "2026년" / "전체 기간" */
  title: string
  rows: readonly ExpenseSummaryRow[]
  categories: ExpenseCategoryTree
  previous: SummaryComparison | null
  /** 달 집계일 때만 (해·전체 집계에는 리터 칸 없음) */
  liters?: LiterSummary[] | null
}) {
  const grandTotal = rows.reduce((sum, r) => sum + r.amount, 0)
  const previousTotal = previous?.total ?? 0
  const breakdown = buildMonthBreakdown(categories, rows)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border p-4">
        <p className={SUMMARY_TITLE_CLASS}>{title} 지출 합계</p>
        <p className="text-2xl font-semibold">{formatKRW(grandTotal)}</p>
        {previous ? (
          <p className="text-sm text-muted-foreground">
            {formatChangeRate(grandTotal, previousTotal, "지출", previous.rateWord)} ({previous.label}{" "}
            {formatKRW(previousTotal)})
          </p>
        ) : null}
      </div>

      {/* 주유비·요소수에 적은 리터: 이번 달 합 · 최근 12개월 중 적은 달의 월 평균 (달 집계만) */}
      {liters ? (
        <div className="rounded-md border">
          <p className="border-b p-3 font-medium">넣은 양 (리터)</p>
          {liters.map((item) => (
            <div key={item.minor} className="flex items-start justify-between gap-3 border-b p-3 last:border-0">
              <span>{item.minor}</span>
              <span className="text-right">
                <span className="font-medium">
                  {item.monthCount > 0 ? formatLiters(item.month) : "기록 없음"}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {item.average !== null
                    ? `월 평균 ${formatLiters(item.average)} (최근 ${item.averageMonths}개월)`
                    : "지출 등록 때 리터를 적으면 모아 보여 줘요"}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

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
