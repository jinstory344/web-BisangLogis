import Link from "next/link"
import { Suspense } from "react"
import { Plus } from "lucide-react"

import { ListBodyFallback } from "@/components/list/list-body-fallback"
import { ListPageHead } from "@/components/list/list-page-head"
import { ListPeriodView } from "@/components/list/list-period-view"
import { ListViewTabs } from "@/components/list/list-view-menu"
import { SECTION_COLORS } from "@/lib/constants/section-colors"
import { SummaryMonthPicker } from "@/components/list/summary-month-picker"
import { Button } from "@/components/ui/button"
import { MonthSwipe } from "@/components/list/month-swipe"
import { getCurrentMonthRangeInSeoul, getTodayInSeoul } from "@/lib/date"
import { formatKRW } from "@/lib/money"
import { DISPATCH_METRIC_KEYS, dispatchMetricRows, rowsInPeriod } from "@/lib/period-metrics"
import {
  getViewRange,
  listAnchor,
  parseListView,
  periodBadge,
  periodTitle,
  previousPeriod,
  type ListView,
} from "@/lib/period-view"
import { createClient } from "@/lib/supabase/server"
import type { DispatchRow } from "@/lib/supabase/database.types"

import {
  filterDispatchesByClient,
  summarizeDispatches,
} from "@/lib/dispatch-list"

import { fetchAllRows } from "../ledger-data"

import { DispatchList } from "./dispatch-list"
import { DispatchMobileControls } from "./dispatch-mobile-controls"
import { DispatchSummaryCard } from "./dispatch-summary"

const PAGE_SIZE = 200 // 한 달 배차가 많아 200건까지는 페이지 넘기기 없이

interface DispatchSearchParams {
  view?: string
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

  return (
    <div className="mx-auto max-w-3xl px-4 pb-4">
      <div className="flex flex-col md:gap-2">
        <ListPageHead
          title="배차"
          titleBarClassName={SECTION_COLORS.dispatch.titleBar}
          desktopTitle="배차 관리"
          desktopAction={
            <Button asChild size="sm">
              <Link href="/dispatches/new">
                <Plus />
                배차 등록
              </Link>
            </Button>
          }
          viewTabs={<ListViewTabs />}
          periodPicker={<SummaryMonthPicker from={from} to={to} />}
        />

        {/* 제목·달 이동은 바로 보내고, 합계·목록은 데이터를 읽는 대로 채운다(스트리밍) */}
        <Suspense fallback={<ListBodyFallback labels={["배차", "운임", "수수료"]} />}>
          <DispatchesBody params={params} />
        </Suspense>
      </div>
    </div>
  )
}

async function DispatchesBody({ params }: { params: DispatchSearchParams }) {
  const view = parseListView(params.view)
  if (view !== "day") return <DispatchesPeriodBody params={params} view={view} />

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

  if (clientId) baseQuery = baseQuery.in("client_id", clientId.split(","))

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
    <MonthSwipe className="flex flex-col gap-3 md:gap-4">
          {/* 모바일 조작부는 contents라서 안의 달 이동·합계가 목록 전체 높이에서 고정될 수 있다 */}
          <div className="contents">
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
  )
}

/**
 * 달력·주별·월별·연별 보기: 금액 줄만 읽어(목록 전체 X) 칸별 건수·운임·수수료와 집계 카드를 만든다.
 * 거래처 거르기는 모든 보기에 그대로 적용된다(기간 직접 지정은 일일 보기에만).
 */
async function DispatchesPeriodBody({
  params,
  view,
}: {
  params: DispatchSearchParams
  view: Exclude<ListView, "day">
}) {
  const defaultRange = getCurrentMonthRangeInSeoul()
  const from = params.from || defaultRange.from
  const to = params.to || defaultRange.to
  const today = getTodayInSeoul()
  const anchor = listAnchor(from, to, defaultRange.from)
  const range = getViewRange(view, anchor)
  const previous = previousPeriod(view, anchor)
  const clientId = params.client_id ?? ""
  const clientName = params.client_name ?? ""

  const supabase = await createClient()
  let rows
  let clientRows
  try {
    ;[rows, { data: clientRows }] = await Promise.all([
      fetchAllRows((a, b) =>
        supabase
          .from("dispatches")
          .select("dispatch_date, client_id, plate_no_snapshot, driver_name_snapshot, freight_amount, fee_amount")
          .is("deleted_at", null)
          .gte("dispatch_date", previous?.from ?? range.from)
          .lte("dispatch_date", range.to)
          .order("dispatch_date")
          .order("id")
          .range(a, b)
      ),
      supabase.from("clients").select("id, name"),
    ])
  } catch (error) {
    return (
      <p className="text-sm text-destructive">
        배차를 불러오지 못했습니다: {error instanceof Error ? error.message : "알 수 없는 오류"}
      </p>
    )
  }

  const clientNameMap: Record<string, string> = Object.fromEntries(
    (clientRows ?? []).map((c) => [c.id, c.name])
  )
  const current = rowsInPeriod(rows, (row) => row.dispatch_date, range.from, range.to)
  const shown = filterDispatchesByClient(current, clientId)
  const previousRows = previous
    ? filterDispatchesByClient(
        rowsInPeriod(rows, (row) => row.dispatch_date, previous.from, previous.to),
        clientId
      )
    : []

  const card =
    view === "week" ? null : (
      <DispatchSummaryCard
        title={periodTitle(view, anchor)}
        rows={shown}
        clientNames={clientNameMap}
        previous={
          previous
            ? {
                label: previous.label,
                rateWord: previous.rateWord,
                count: previousRows.length,
                total: previousRows.reduce((sum, row) => sum + (row.freight_amount ?? 0), 0),
              }
            : null
        }
      />
    )

  return (
    <MonthSwipe className="flex flex-col gap-3 md:gap-4">
      <div className="contents">
        <DispatchMobileControls
          from={from}
          to={to}
          clientId={clientId}
          clientName={clientName}
          summary={summarizeDispatches(current)}
          clientNames={clientNameMap}
          periodLabel={periodBadge(view, anchor)}
        />
      </div>

      <ListPeriodView
        view={view}
        anchor={anchor}
        today={today}
        pathname="/dispatches"
        params={{ ...params }}
        rows={dispatchMetricRows(shown)}
        keys={DISPATCH_METRIC_KEYS}
        cellLines={({ count, sums }) => [
          { text: `${count}건`, className: "text-muted-foreground" },
          ...(sums.freight > 0 ? [{ text: sums.freight.toLocaleString("ko-KR") }] : []),
        ]}
        rowView={({ count, sums }) => ({
          countText: `${count}건`,
          value: formatKRW(sums.freight),
          details: [
            { text: `수수료 ${formatKRW(sums.fee)}`, className: "text-muted-foreground" },
          ],
        })}
        summaryCard={card}
      />
    </MonthSwipe>
  )
}
