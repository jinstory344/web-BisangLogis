import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getCurrentMonthRangeInSeoul } from "@/lib/date"
import { createClient } from "@/lib/supabase/server"
import type { ExpenseRow } from "@/lib/supabase/database.types"

import { ExpenseFilters } from "./expense-filters"
import { ExpenseList } from "./expense-list"
import { ExpenseSummary } from "./expense-summary"

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

  let summaryQuery = supabase
    .from("expenses")
    .select("category_major, amount")
    .is("deleted_at", null)
    .gte("expense_date", from)
    .lte("expense_date", to)

  if (categoryMajor) summaryQuery = summaryQuery.eq("category_major", categoryMajor)
  if (categoryMinor) summaryQuery = summaryQuery.eq("category_minor", categoryMinor)

  // 서로 독립된 조회라 순차 대기 대신 동시에 보내 왕복 지연을 줄인다.
  const [{ data, error, count }, { data: summaryRows }] = await Promise.all([
    baseQuery.order("expense_date", { ascending: false }).range(rangeStart, rangeEnd),
    summaryQuery,
  ])

  const byMajorMap = new Map<string, number>()
  let total = 0
  for (const row of summaryRows ?? []) {
    total += row.amount
    byMajorMap.set(
      row.category_major,
      (byMajorMap.get(row.category_major) ?? 0) + row.amount
    )
  }
  const byMajor = Array.from(byMajorMap.entries()).map(([major, sum]) => ({
    major,
    total: sum,
  }))

  const summary = {
    count: summaryRows?.length ?? 0,
    total,
    byMajor,
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">지출 관리</h1>
        <Button asChild size="sm">
          <Link href="/expenses/new">
            <Plus />
            지출 등록
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="list" className="mt-4">
        <TabsList>
          <TabsTrigger value="list">목록</TabsTrigger>
          <TabsTrigger value="summary">월간 집계</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="flex flex-col gap-4">
          <ExpenseFilters
            from={from}
            to={to}
            categoryMajor={categoryMajor}
            categoryMinor={categoryMinor}
          />

          {error ? (
            <p className="text-sm text-destructive">
              지출 목록을 불러오지 못했습니다: {error.message}
            </p>
          ) : (
            <ExpenseList
              expenses={(data ?? []) as ExpenseRow[]}
              summary={summary}
              page={page}
              totalPages={totalPages}
            />
          )}
        </TabsContent>

        <TabsContent value="summary">
          <ExpenseSummary />
        </TabsContent>
      </Tabs>
    </div>
  )
}
