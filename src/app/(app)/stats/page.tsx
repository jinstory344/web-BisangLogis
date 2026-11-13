import Link from "next/link"

import { SearchButton } from "@/components/layout/search-button"

import { MonthSwipe } from "@/components/list/month-swipe"
import { SummaryMonthNav } from "@/components/list/summary-month-nav"

import { getCurrentMonthRangeInSeoul, getMonthRange } from "@/lib/date"
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
  const month = getMonthRange(from)

  return (
    <div className="px-4 pb-4 md:p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        {/* 위에 고정: 제목 + 종류 탭 (비상 화면과 같은 모양) */}
        <div className="sticky top-0 z-30 -mx-4 bg-background px-4 pt-2 md:static md:mx-0 md:px-0 md:pt-0">
          <header className="grid h-10 grid-cols-[2.5rem_1fr_2.5rem] items-center">
            <SearchButton />
            <h1 className="text-center text-lg font-semibold tracking-tight">통계</h1>
            <span aria-hidden />
          </header>

          {/* HOME과 같은 순서: 제목 → ‹ 달 › → 종류 탭 */}
          <SummaryMonthNav from={month.from} to={month.to} />

          <nav
            aria-label="통계 종류"
            className="-mx-4 grid grid-cols-3 border-b px-2 md:mx-0 md:px-0"
          >
            {STAT_TYPES.map((item) => {
              const isActive = item.value === type
              return (
                <Link
                  key={item.value}
                  href={`/stats?type=${item.value}&from=${from}`}
                  // 옆 보기도 미리 받아 두어 누르면 바로 뜨게 한다.
                  prefetch
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-9 items-center justify-center px-3 text-sm whitespace-nowrap transition-colors",
                    isActive
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                  {isActive ? (
                    <span
                      aria-hidden
                      className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-red-400"
                    />
                  ) : null}
                </Link>
              )
            })}
          </nav>
        </div>

        <MonthSwipe>
        {type === "sales" ? (
          <SalesSummary from={from} monthNav="hidden" />
        ) : type === "expenses" ? (
          <ExpenseSummary
            from={from}
            categories={(await getExpenseCategories()).tree}
            monthNav="hidden"
          />
        ) : (
          <DispatchSummary from={from} monthNav="hidden" />
        )}
        </MonthSwipe>
      </div>
    </div>
  )
}
