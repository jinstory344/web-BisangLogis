import { DonutChart } from "@/components/stats/donut-chart"
import { PAID_TEXT_CLASS } from "@/components/dispatches/payment-badge"
import { formatYearMonth, getMonthRange, shiftMonthRange } from "@/lib/date"
import { formatKRW } from "@/lib/money"
import { summarizeSalesMonth } from "@/lib/sales-summary"
import { formatChangeRate, percentOf, SUMMARY_TITLE_CLASS, type SummaryComparison } from "@/lib/summary"
import { createClient } from "@/lib/supabase/server"
import type { PaymentStatus } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

export interface SalesSummaryRow {
  source_major: string | null
  source_minor: string | null
  supply_amount: number
  total_amount: number
  payment_status: PaymentStatus
}

/**
 * 매출 월간 집계 탭: 목록 탭에서 보고 있는 달(from이 속한 달)의 매출을
 * 공급가액 기준으로 합계 · 전월 대비 · 입금/미입금 · 출처별(대분류 → 소분류)로 보여 준다.
 */
export async function SalesSummary({ from }: { from: string }) {
  const supabase = await createClient()
  const month = getMonthRange(from)
  const previous = shiftMonthRange(from, -1)

  const [{ data: currentRows, error: currentError }, { data: previousRows }] =
    await Promise.all([
      supabase
        .from("sales")
        .select(
          "source_major, source_minor, supply_amount, total_amount, payment_status"
        )
        .is("deleted_at", null)
        .gte("sale_date", month.from)
        .lte("sale_date", month.to),
      supabase
        .from("sales")
        .select("supply_amount")
        .is("deleted_at", null)
        .gte("sale_date", previous.from)
        .lte("sale_date", previous.to),
    ])

  if (currentError) {
    return (
      <p className="text-sm text-destructive">
        월간 집계를 불러오지 못했습니다: {currentError.message}
      </p>
    )
  }

  return (
    <SalesSummaryCard
      title={formatYearMonth(month.from)}
      rows={currentRows ?? []}
      previous={{
        label: "지난 달",
        rateWord: "전월",
        total: (previousRows ?? []).reduce((sum, row) => sum + row.supply_amount, 0),
      }}
    />
  )
}

/**
 * 매출 집계 카드(통계 화면·매출 달력/월별/연별 보기): 공급가액 합계 · 비교 · 입금/미입금 · 출처별 도넛과 목록.
 */
export function SalesSummaryCard({
  title,
  rows,
  previous,
}: {
  /** "2026년 11월" / "2026년" / "전체 기간" */
  title: string
  rows: readonly SalesSummaryRow[]
  previous: SummaryComparison | null
}) {
  const summary = summarizeSalesMonth(rows)
  const previousTotal = previous?.total ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border p-4">
        <p className={SUMMARY_TITLE_CLASS}>{title} 매출 합계 (공급가액)</p>
        <p className="text-2xl font-semibold tabular-nums">
          {formatKRW(summary.supplyAmount)}
        </p>
        {previous ? (
          <p className="text-sm text-muted-foreground">
            {formatChangeRate(summary.supplyAmount, previousTotal, "매출", previous.rateWord)} (
            {previous.label} {formatKRW(previousTotal)})
          </p>
        ) : null}
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-0.5 text-sm tabular-nums">
          <span className={cn("font-medium", PAID_TEXT_CLASS)}>
            입금 {formatKRW(summary.paidSupplyAmount)}
          </span>
          <span
            className={cn(
              "font-medium",
              summary.unpaidSupplyAmount > 0
                ? "text-destructive"
                : "text-muted-foreground"
            )}
          >
            미입금 {formatKRW(summary.unpaidSupplyAmount)}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {summary.count}건 · 세액 포함 합계금액 {formatKRW(summary.totalAmount)}
        </p>
      </div>

      <DonutChart
        ariaLabel="매출 출처별 비율"
        items={summary.byMajor.map((major) => ({
          label: major.major,
          value: major.supplyAmount,
        }))}
      />

      {summary.byMajor.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          이 기간에 등록된 매출이 없습니다.
        </p>
      ) : (
        <div className="rounded-md border">
          {summary.byMajor.map((major) => (
            <div key={major.major} className="border-b last:border-0">
              <div className="flex items-center justify-between gap-3 p-3 font-medium">
                <span>
                  {major.major}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {major.count}건
                  </span>
                </span>
                <span className="tabular-nums">
                  {formatKRW(major.supplyAmount)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({percentOf(major.supplyAmount, summary.supplyAmount)}%)
                  </span>
                </span>
              </div>
              <div className="flex flex-col gap-1 px-3 pb-3 pl-6">
                {major.minors.map((minor) => (
                  <div
                    key={minor.minor}
                    className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
                  >
                    <span className="min-w-0 truncate">
                      {minor.minor}{" "}
                      <span className="text-xs">{minor.count}건</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatKRW(minor.supplyAmount)} (
                      {percentOf(minor.supplyAmount, summary.supplyAmount)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
