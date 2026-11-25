import Link from "next/link"
import { Suspense } from "react"
import { Plus } from "lucide-react"

import { ListBodyFallback } from "@/components/list/list-body-fallback"
import { EXPENSE_TEXT_CLASS } from "@/components/ledger/colors"
import { ListPageHead } from "@/components/list/list-page-head"
import { ListPeriodView } from "@/components/list/list-period-view"
import { ListViewTabs } from "@/components/list/list-view-menu"
import { SummaryMonthPicker } from "@/components/list/summary-month-picker"
import { Button } from "@/components/ui/button"
import { MonthSwipe } from "@/components/list/month-swipe"
import { loadServiceItemNamesForExpenses } from "@/lib/car-ledger/service-items-db"
import { getCurrentMonthRangeInSeoul, getTodayInSeoul } from "@/lib/date"
import { formatKRW } from "@/lib/money"
import { AMOUNT_METRIC_KEYS, expenseMetricRows, rowsInPeriod } from "@/lib/period-metrics"
import {
  getViewRange,
  listAnchor,
  parseListView,
  periodBadge,
  type ListView,
} from "@/lib/period-view"
import { createClient } from "@/lib/supabase/server"
import type { ExpenseRow } from "@/lib/supabase/database.types"

import { getMajors } from "@/lib/constants/expense-categories"
import { filterExpenses, summarizeExpenses } from "@/lib/expense-list"

import { fetchAllRows } from "../ledger-data"

import { ExpenseList } from "./expense-list"
import { ExpenseMobileControls } from "./expense-mobile-controls"
import { getExpenseCategories } from "./categories"

const PAGE_SIZE = 100 // 100건까지는 페이지 넘기기 없이

interface ExpenseSearchParams {
  view?: string
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

  return (
    <div className="mx-auto max-w-3xl px-4 pb-4">
      <div className="flex flex-col md:gap-2">
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
          viewTabs={<ListViewTabs />}
          periodPicker={<SummaryMonthPicker from={from} to={to} />}
        />

        {/* 제목·달 이동은 바로 보내고, 합계·목록은 데이터를 읽는 대로 채운다(스트리밍) */}
        <Suspense fallback={<ListBodyFallback labels={["지출 합계"]} />}>
          <ExpensesBody params={params} />
        </Suspense>
      </div>
    </div>
  )
}

async function ExpensesBody({ params }: { params: ExpenseSearchParams }) {
  const view = parseListView(params.view)
  if (view !== "day") return <ExpensesPeriodBody params={params} view={view} />

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
  // 정비 줄의 항목 이름 (비고 앞에 붙인다)
  const serviceItemNames = Object.fromEntries(
    await loadServiceItemNamesForExpenses(supabase, (data ?? []) as ExpenseRow[])
  )

  return (
    <MonthSwipe className="flex flex-col gap-3 md:gap-4">
          {/* 모바일 조작부는 contents라서 안의 달 이동·합계가 목록 전체 높이에서 고정될 수 있다 */}
          <div className="contents">
            <ExpenseMobileControls
              from={from}
              to={to}
              categoryMajor={categoryMajor}
              categoryMinor={categoryMinor}
              summary={rangeSummary}
              categories={categories}
              filteredTotal={filtered.total}
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
              serviceItemNames={serviceItemNames}
            />
          )}
          </MonthSwipe>
  )
}

/**
 * 달력·주별·월별·연별 보기: 금액 줄만 읽어(목록 전체 X) 칸별 합계와 집계 카드를 만든다.
 * 거르기(대분류·소분류)는 모든 보기에 그대로 적용된다. 할부는 회차 줄 금액(목록과 같은 기준).
 */
async function ExpensesPeriodBody({
  params,
  view,
}: {
  params: ExpenseSearchParams
  view: Exclude<ListView, "day">
}) {
  const defaultRange = getCurrentMonthRangeInSeoul()
  const from = params.from || defaultRange.from
  const to = params.to || defaultRange.to
  const today = getTodayInSeoul()
  const anchor = listAnchor(from, to, defaultRange.from)
  const range = getViewRange(view, anchor)
  const categoryMajor = params.category_major ?? ""
  const categoryMinor = params.category_minor ?? ""

  const supabase = await createClient()
  let rows
  let categories
  try {
    ;[rows, { tree: categories }] = await Promise.all([
      fetchAllRows((a, b) =>
        supabase
          .from("expenses")
          .select("expense_date, category_major, category_minor, amount")
          .is("deleted_at", null)
          .gte("expense_date", range.from)
          .lte("expense_date", range.to)
          .order("expense_date")
          .order("id")
          .range(a, b)
      ),
      getExpenseCategories(),
    ])
  } catch (error) {
    return (
      <p className="text-sm text-destructive">
        지출을 불러오지 못했습니다: {error instanceof Error ? error.message : "알 수 없는 오류"}
      </p>
    )
  }

  const current = rowsInPeriod(rows, (row) => row.expense_date, range.from, range.to)
  const shown = filterExpenses(current, categoryMajor, categoryMinor)


  return (
    <MonthSwipe className="flex flex-col gap-3 md:gap-4">
      <div className="contents">
        <ExpenseMobileControls
          from={from}
          to={to}
          categoryMajor={categoryMajor}
          categoryMinor={categoryMinor}
          summary={summarizeExpenses(current, getMajors(categories))}
          categories={categories}
          filteredTotal={shown.reduce((sum, row) => sum + row.amount, 0)}
          periodLabel={periodBadge(view, anchor)}
        />
      </div>

      <ListPeriodView
        view={view}
        anchor={anchor}
        today={today}
        pathname="/expenses"
        params={{ ...params }}
        rows={expenseMetricRows(shown)}
        keys={AMOUNT_METRIC_KEYS}
        cellLines={({ sums }) => [{ text: sums.amount.toLocaleString("ko-KR"), className: EXPENSE_TEXT_CLASS }]}
        rowView={({ count, sums }) => ({
          countText: `${count}건`,
          value: formatKRW(sums.amount),
          valueClassName: EXPENSE_TEXT_CLASS,
        })}
      />
    </MonthSwipe>
  )
}
