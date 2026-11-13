import Link from "next/link"
import { Plus } from "lucide-react"

import { ListPageHead } from "@/components/list/list-page-head"
import { SummaryMonthNav } from "@/components/list/summary-month-nav"
import { Button } from "@/components/ui/button"
import { MonthSwipe } from "@/components/list/month-swipe"
import { getCurrentMonthRangeInSeoul, isAllPeriod } from "@/lib/date"
import { createClient } from "@/lib/supabase/server"
import type { DispatchRow } from "@/lib/supabase/database.types"

import {
  filterDispatchesByClient,
  summarizeDispatches,
} from "@/lib/dispatch-list"

import { DispatchFilters } from "./dispatch-filters"
import { DispatchList } from "./dispatch-list"
import { DispatchMobileControls } from "./dispatch-mobile-controls"

const PAGE_SIZE = 50

interface DispatchSearchParams {
  from?: string
  to?: string
  client_id?: string
  client_name?: string
  page?: string
}

export default async function DispatchesPage({
  searchParams,
}: {
  searchParams: Promise<DispatchSearchParams>
}) {
  const params = await searchParams
  const defaultRange = getCurrentMonthRangeInSeoul()
  const from = params.from || defaultRange.from
  const to = params.to || defaultRange.to
  const clientId = params.client_id ?? ""
  const clientName = params.client_name ?? ""
  const page = Math.max(1, Number(params.page) || 1)

  const supabase = await createClient()

  let baseQuery = supabase
    .from("dispatches")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .gte("dispatch_date", from)
    .lte("dispatch_date", to)

  if (clientId) baseQuery = baseQuery.eq("client_id", clientId)

  const rangeStart = (page - 1) * PAGE_SIZE
  const rangeEnd = rangeStart + PAGE_SIZE - 1

  // 합계: 페이지가 아닌 전체 기준. 거래처 필터는 빼고 기간 안의 배차를 한 번에 가져와서
  // 모바일 상단의 전체 요약과 거래처 칩을 만들고, 목록 합계는 그중 선택한 거래처 몫이다.
  const summaryQuery = supabase
    .from("dispatches")
    .select("client_id, freight_amount, fee_amount")
    .is("deleted_at", null)
    .gte("dispatch_date", from)
    .lte("dispatch_date", to)

  // 거래처 이름은 표가 작아서 따로 기다리지 않고 같이 한 번에 읽는다 (순차 왕복 한 번 줄이기).
  const [
    { data, error, count },
    { data: summaryRows },
    { data: clientRows },
  ] = await Promise.all([
    baseQuery
      .order("dispatch_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(rangeStart, rangeEnd),
    summaryQuery,
    supabase.from("clients").select("id, name"),
  ])

  const rangeSummary = summarizeDispatches(summaryRows ?? [])
  const summary = summarizeDispatches(
    filterDispatchesByClient(summaryRows ?? [], clientId)
  )

  // 목록 행과 거래처 칩에 쓸 거래처 이름
  const clientNameMap: Record<string, string> = Object.fromEntries(
    (clientRows ?? []).map((c) => [c.id, c.name])
  )

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  return (
    <div className="px-4 pb-4 md:p-6">
      <div className="flex flex-col md:gap-2">
        <ListPageHead
          title="배차"
          desktopTitle="배차 관리"
          desktopAction={
            <Button asChild size="sm">
              <Link href="/dispatches/new">
                <Plus />
                배차 등록
              </Link>
            </Button>
          }
          monthNav={<SummaryMonthNav from={from} to={to} />}
          statsHref={`/stats?type=dispatches&from=${isAllPeriod({ from, to }) ? defaultRange.from : from}`}
        />

          <MonthSwipe className="flex flex-col gap-3 md:gap-4">
          <div className="hidden md:block">
            <DispatchFilters
              from={from}
              to={to}
              clientId={clientId}
              clientName={clientName}
            />
          </div>
          {/* 모바일 조작부는 contents라서 안의 달 이동·합계가 목록 전체 높이에서 고정될 수 있다 */}
          <div className="contents md:hidden">
            <DispatchMobileControls
              from={from}
              to={to}
              clientId={clientId}
              clientName={clientName}
              summary={rangeSummary}
              clientNames={clientNameMap}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive">
              배차 목록을 불러오지 못했습니다: {error.message}
            </p>
          ) : (
            <DispatchList
              dispatches={(data ?? []) as DispatchRow[]}
              clientNameMap={clientNameMap}
              totalCount={count ?? 0}
              summary={summary}
              page={page}
              totalPages={totalPages}
            />
          )}
          </MonthSwipe>
      </div>
    </div>
  )
}
