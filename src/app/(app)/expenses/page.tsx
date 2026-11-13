import Link from "next/link"
import { Plus } from "lucide-react"

import { ListPageHead } from "@/components/list/list-page-head"
import { SummaryMonthNav } from "@/components/list/summary-month-nav"
import { Button } from "@/components/ui/button"
import { MonthSwipe } from "@/components/list/month-swipe"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { getCurrentMonthRangeInSeoul } from "@/lib/date"
import { createClient } from "@/lib/supabase/server"
import type { ExpenseRow } from "@/lib/supabase/database.types"

import { getMajors } from "@/lib/constants/expense-categories"
import { filterExpenses, summarizeExpenses } from "@/lib/expense-list"

import { ExpenseFilters } from "./expense-filters"
import { ExpenseList } from "./expense-list"
import { ExpenseMobileControls } from "./expense-mobile-controls"
import { ExpenseSummary } from "./expense-summary"
import { getExpenseCategories } from "./categories"

const PAGE_SIZE = 50

interface ExpenseSearchParams {
  from?: string
  to?: string
  category_major?: string
  category_minor?: string
  page?: string
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<ExpenseSearchParams>
}) {
  const params = await searchParams
  const defaultRange = getCurrentMonthRangeInSeoul()
  const from = params.from || defaultRange.from
  const to = params.to || defaultRange.to
  const categoryMajor = params.category_major ?? ""
  const categoryMinor = params.category_minor ?? ""
  const page = Math.max(1, Number(params.page) || 1)

  const supabase = await createClient()

  let baseQuery = supabase
    .from("expenses")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .gte("expense_date", from)
    .lte("expense_date", to)

  if (categoryMajor) baseQuery = baseQuery.eq("category_major", categoryMajor)
  if (categoryMinor) baseQuery = baseQuery.eq("category_minor", categoryMinor)

  const rangeStart = (page - 1) * PAGE_SIZE
  const rangeEnd = rangeStart + PAGE_SIZE - 1

  // 목록 합계: 페이지가 아닌 필터 전체 기준. 대분류·소분류 필터는 빼고 기간 안의 지출을 한 번에 가져와서
  // 모바일 상단의 전체/대분류별 건수·금액을 만들고, 목록 합계는 그중 선택한 분류 몫이다.
  const summaryQuery = supabase
    .from("expenses")
    .select("category_major, category_minor, amount")
    .is("deleted_at", null)
    .gte("expense_date", from)
    .lte("expense_date", to)

  // 서로 독립된 조회라 순차 대기 대신 동시에 보내 왕복 지연을 줄인다.
  const [{ data, error, count }, { data: summaryRows }, { tree: categories }] =
    await Promise.all([
      baseQuery
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(rangeStart, rangeEnd),
      summaryQuery,
      getExpenseCategories(),
    ])

  const majorOrder = getMajors(categories)
  const rangeSummary = summarizeExpenses(summaryRows ?? [], majorOrder)
  const filtered = summarizeExpenses(
    filterExpenses(summaryRows ?? [], categoryMajor, categoryMinor),
    majorOrder
  )
  const summary = {
    count: filtered.count,
    total: filtered.total,
    byMajor: filtered.byMajor
      .filter((major) => major.count > 0)
      .map((major) => ({ major: major.major, total: major.total })),
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  return (
    <div className="px-4 pb-4 md:p-6">
      <Tabs defaultValue="list" className="gap-0 md:gap-2">
        <ListPageHead
          title="지출"
          desktopTitle="지출 관리"
          desktopAction={
            <Button asChild size="sm">
              <Link href="/expenses/new">
                <Plus />
                지출 등록
              </Link>
            </Button>
          }
          monthNav={<SummaryMonthNav from={from} to={to} />}
          tabs={[
            { value: "list", label: "목록" },
            { value: "summary", label: "월간 집계" },
          ]}
        />

        <TabsContent value="list">
          <MonthSwipe className="flex flex-col gap-3 md:gap-4">
          <div className="hidden md:block">
            <ExpenseFilters
              from={from}
              to={to}
              categoryMajor={categoryMajor}
              categoryMinor={categoryMinor}
              categories={categories}
            />
          </div>
          {/* 모바일 조작부는 contents라서 안의 달 이동·합계가 목록 전체 높이에서 고정될 수 있다 */}
          <div className="contents md:hidden">
            <ExpenseMobileControls
              from={from}
              to={to}
              categoryMajor={categoryMajor}
              categoryMinor={categoryMinor}
              summary={rangeSummary}
              categories={categories}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive">
              지출 목록을 불러오지 못했습니다: {error.message}
            </p>
          ) : (
            <ExpenseList
              key={`${from}-${to}-${categoryMajor}-${categoryMinor}-${page}`}
              expenses={(data ?? []) as ExpenseRow[]}
              summary={summary}
              page={page}
              totalPages={totalPages}
            />
          )}
          </MonthSwipe>
        </TabsContent>

        <TabsContent value="summary" className="pt-3 md:pt-0">
          <MonthSwipe>
          <ExpenseSummary from={from} monthNav="desktop" categories={categories} />
          </MonthSwipe>
        </TabsContent>
      </Tabs>
    </div>
  )
}
