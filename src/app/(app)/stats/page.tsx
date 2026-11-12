import Link from "next/link"

import { MonthSwipe } from "@/components/list/month-swipe"

import { getCurrentMonthRangeInSeoul } from "@/lib/date"
import { parseAnchorDate } from "@/lib/ledger"
import { cn } from "@/lib/utils"

import { DispatchSummary } from "../dispatches/dispatch-summary"
import { getExpenseCategories } from "../expenses/categories"
import { ExpenseSummary } from "../expenses/expense-summary"
import { SalesSummary } from "../sales/sales-summary"

const STAT_TYPES = [
  { value: "sales", label: "매출" },
  { value: "expenses", label: "지출" },
  { value: "dispatches", label: "배차" },
] as const

type StatType = (typeof STAT_TYPES)[number]["value"]

function parseStatType(raw: string | string[] | undefined): StatType {
  const value = Array.isArray(raw) ? raw[0] : raw
  return STAT_TYPES.some((t) => t.value === value) ? (value as StatType) : "sales"
}

/**
 * 통계(하단 탭): 매출 · 지출 · 배차의 월간 집계를 한곳에서 본다.
 * 각 집계 위쪽의 ‹ 달 이동 › 은 이 화면 주소의 from·to를 바꾼다.
 */
export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[]; from?: string | string[] }>
}) {
  const params = await searchParams
  const type = parseStatType(params.type)
  const from = parseAnchorDate(params.from, getCurrentMonthRangeInSeoul().from)

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <h1 className="text-2xl font-semibold">통계</h1>

        <nav
          aria-label="통계 종류"
          className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-[3px]"
        >
          {STAT_TYPES.map((item) => {
            const isActive = item.value === type
            return (
              <Link
                key={item.value}
                href={`/stats?type=${item.value}&from=${from}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center justify-center rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <MonthSwipe>
        {type === "sales" ? (
          <SalesSummary from={from} />
        ) : type === "expenses" ? (
          <ExpenseSummary
            from={from}
            categories={(await getExpenseCategories()).tree}
          />
        ) : (
          <DispatchSummary from={from} />
        )}
        </MonthSwipe>
      </div>
    </div>
  )
}
