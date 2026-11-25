import Link from "next/link"
import { Suspense } from "react"
import { Plus } from "lucide-react"

import { ListBodyFallback } from "@/components/list/list-body-fallback"
import { INCOME_TEXT_CLASS } from "@/components/ledger/colors"
import { PAID_TEXT_CLASS } from "@/components/dispatches/payment-badge"
import { ListPageHead } from "@/components/list/list-page-head"
import { ListPeriodView } from "@/components/list/list-period-view"
import { ListViewTabs } from "@/components/list/list-view-menu"
import { SummaryMonthPicker } from "@/components/list/summary-month-picker"
import { Button } from "@/components/ui/button"
import { MonthSwipe } from "@/components/list/month-swipe"
import { getCurrentMonthRangeInSeoul, getTodayInSeoul } from "@/lib/date"
import { formatKRW } from "@/lib/money"
import { rowsInPeriod, SALE_METRIC_KEYS, saleMetricRows } from "@/lib/period-metrics"
import {
  getViewRange,
  listAnchor,
  parseListView,
  periodBadge,
  type ListView,
} from "@/lib/period-view"
import { createClient } from "@/lib/supabase/server"
import type { PaymentMethod, PaymentStatus, SaleRow } from "@/lib/supabase/database.types"

import { pickStatusTotals, summarizeByPaymentStatus } from "@/lib/sales-list"

import { fetchAllRows } from "../ledger-data"

import { SalesCalendar } from "./sales-calendar"
import { SalesList } from "./sales-list"
import { SalesMobileControls } from "./sales-mobile-controls"
import { getSaleSources } from "./sources"

const PAGE_SIZE = 100 // 100건까지는 페이지 넘기기 없이

/** 주별·월별·연별 합계에 쓰는 매출 금액 칸 */
type SaleAmountRow = Pick<
  SaleRow,
  "sale_date" | "source_major" | "source_minor" | "supply_amount" | "total_amount" | "payment_status"
>

interface SalesSearchParams {
  view?: string
  from?: string
  to?: string
  source_major?: string
  source_sub?: string
  payment_status?: string
  payment_method?: string
  page?: string
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<SalesSearchParams>
}) {
  const params = await searchParams
  const defaultRange = getCurrentMonthRangeInSeoul()
  const from = params.from || defaultRange.from
  const to = params.to || defaultRange.to

  return (
    <div className="mx-auto max-w-3xl px-4 pb-4">
      <div className="flex flex-col md:gap-2">
        <ListPageHead
          title="매출"
          desktopTitle="매출 관리"
          desktopAction={
            <Button asChild size="sm">
              <Link href="/sales/new">
                <Plus />
                매출 등록
              </Link>
            </Button>
          }
          viewTabs={<ListViewTabs />}
          periodPicker={<SummaryMonthPicker from={from} to={to} />}
        />

        {/* 제목·달 이동은 바로 보내고, 합계·목록은 데이터를 읽는 대로 채운다(스트리밍) */}
        <Suspense fallback={<ListBodyFallback labels={["매출", "입금", "미입금"]} />}>
          <SalesBody params={params} />
        </Suspense>
      </div>
    </div>
  )
}

async function SalesBody({ params }: { params: SalesSearchParams }) {
  const view = parseListView(params.view)
  if (view !== "day") return <SalesPeriodBody params={params} view={view} />

  const defaultRange = getCurrentMonthRangeInSeoul()
  const from = params.from || defaultRange.from
  const to = params.to || defaultRange.to
  const sourceMajor = params.source_major ?? ""
  // 하위분류(카카오톡 › 스마일 등)는 대분류를 고른 때만
  const sourceSub = sourceMajor ? (params.source_sub ?? "") : ""
  const paymentStatus = params.payment_status ?? ""
  const paymentMethod = params.payment_method ?? ""
  const page = Math.max(1, Number(params.page) || 1)

  const supabase = await createClient()

  let baseQuery = supabase
    .from("sales")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .gte("sale_date", from)
    .lte("sale_date", to)

  if (sourceMajor) baseQuery = baseQuery.eq("source_major", sourceMajor)
  if (sourceSub) baseQuery = baseQuery.eq("source_sub", sourceSub)
  if (paymentStatus) {
    baseQuery = baseQuery.eq("payment_status", paymentStatus as PaymentStatus)
  }
  if (paymentMethod) {
    baseQuery = baseQuery.eq("payment_method", paymentMethod as PaymentMethod)
  }

  const rangeStart = (page - 1) * PAGE_SIZE
  const rangeEnd = rangeStart + PAGE_SIZE - 1

  // 4.4 목록 합계: 페이지가 아닌 필터 전체 기준. 입금여부 필터는 빼고 가져와서
  // 모바일 상단의 전체/미입금/입금완료 건수·금액을 한 번에 만들고, 목록 합계는 그중 선택한 입금여부 몫이다.
  let summaryQuery = supabase
    .from("sales")
    .select("payment_status, total_amount, supply_amount")
    .is("deleted_at", null)
    .gte("sale_date", from)
    .lte("sale_date", to)

  if (sourceMajor) summaryQuery = summaryQuery.eq("source_major", sourceMajor)
  if (sourceSub) summaryQuery = summaryQuery.eq("source_sub", sourceSub)
  if (paymentMethod) {
    summaryQuery = summaryQuery.eq(
      "payment_method",
      paymentMethod as PaymentMethod
    )
  }

  // 서로 독립된 조회라 순차 대기 대신 동시에 보내 왕복 지연을 줄인다.
  const [
    { data, error, count },
    { data: summaryRows, error: summaryError },
    { tree: sourceTree },
  ] = await Promise.all([
    baseQuery
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(rangeStart, rangeEnd),
    summaryQuery,
    getSaleSources(),
  ])

  const statusSummary = summarizeByPaymentStatus(summaryRows ?? [])
  const summary = pickStatusTotals(statusSummary, paymentStatus)

  // 개별 건 합계 === 표시된 합계 검산 (4.3.8). 조회 자체가 실패한 경우는
  // 아래 별도 에러 메시지로 안내하므로 검산 배너 대상이 아니다.
  const hasFetchError = !!error || !!summaryError
  const reconciliationMismatch =
    !hasFetchError && summary.count !== (count ?? 0)

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  return (
    <MonthSwipe className="flex flex-col gap-3 md:gap-4">
          {reconciliationMismatch ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              검산 경고: 개별 건 합계와 표시된 합계가 일치하지 않습니다. 새로고침
              후에도 반복되면 관리자에게 문의하세요.
            </div>
          ) : null}

          {/* 모바일 조작부는 contents라서 안의 달 이동·합계가 목록 전체 높이에서 고정될 수 있다 */}
          <div className="contents">
            <SalesMobileControls
              from={from}
              to={to}
              sourceMajor={sourceMajor}
              sourceSub={sourceSub}
              sourceTree={sourceTree}
              paymentStatus={paymentStatus}
              paymentMethod={paymentMethod}
              summary={statusSummary}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive">
              매출 목록을 불러오지 못했습니다: {error.message}
            </p>
          ) : (
            <SalesList
              key={`${from}-${to}-${sourceMajor}-${sourceSub}-${paymentStatus}-${paymentMethod}-${page}`}
              sales={(data ?? []) as SaleRow[]}
              summary={summary}
              page={page}
              totalPages={totalPages}
            />
          )}
          </MonthSwipe>
  )
}

/**
 * 달력·주별·월별·연별 보기: 칸별 합계를 만든다(달력은 그 달 매출 전체, 나머지는 금액 줄만).
 * 거르기(출처·하위분류·지불방법·입금 상태)는 모든 보기에 그대로 적용된다.
 */
async function SalesPeriodBody({
  params,
  view,
}: {
  params: SalesSearchParams
  view: Exclude<ListView, "day">
}) {
  const defaultRange = getCurrentMonthRangeInSeoul()
  const from = params.from || defaultRange.from
  const to = params.to || defaultRange.to
  const today = getTodayInSeoul()
  const anchor = listAnchor(from, to, defaultRange.from)
  const range = getViewRange(view, anchor)
  const sourceMajor = params.source_major ?? ""
  const sourceSub = sourceMajor ? (params.source_sub ?? "") : ""
  const paymentStatus = params.payment_status ?? ""
  const paymentMethod = params.payment_method ?? ""

  const supabase = await createClient()
  // 달력 보기는 그날 내역을 바로 펼치도록 그 달 매출 전체(일일 목록과 같은 칸)를 한 번에 읽는다.
  // 주별·월별·연별은 기간이 길어 금액 칸만.
  const loadRows = async (): Promise<{ rows: SaleAmountRow[]; full: SaleRow[] | null }> => {
    if (view === "calendar") {
      const full = await fetchAllRows((a, b) => {
        let query = supabase
          .from("sales")
          .select("*")
          .is("deleted_at", null)
          .gte("sale_date", range.from)
          .lte("sale_date", range.to)
        if (sourceMajor) query = query.eq("source_major", sourceMajor)
        if (sourceSub) query = query.eq("source_sub", sourceSub)
        if (paymentMethod) query = query.eq("payment_method", paymentMethod as PaymentMethod)
        // 그날 안에서는 일일 목록처럼 최근 등록 먼저
        return query.order("sale_date").order("created_at", { ascending: false }).order("id").range(a, b)
      })
      return { rows: full, full: full as SaleRow[] }
    }
    const rows = await fetchAllRows((a, b) => {
      let query = supabase
        .from("sales")
        .select("sale_date, source_major, source_minor, supply_amount, total_amount, payment_status")
        .is("deleted_at", null)
        .gte("sale_date", range.from)
        .lte("sale_date", range.to)
      if (sourceMajor) query = query.eq("source_major", sourceMajor)
      if (sourceSub) query = query.eq("source_sub", sourceSub)
      if (paymentMethod) query = query.eq("payment_method", paymentMethod as PaymentMethod)
      return query.order("sale_date").order("id").range(a, b)
    })
    return { rows, full: null }
  }

  let loaded
  let sourceTree
  try {
    ;[loaded, { tree: sourceTree }] = await Promise.all([loadRows(), getSaleSources()])
  } catch (error) {
    return (
      <p className="text-sm text-destructive">
        매출을 불러오지 못했습니다: {error instanceof Error ? error.message : "알 수 없는 오류"}
      </p>
    )
  }
  const { rows, full } = loaded

  const byStatus = (row: { payment_status: PaymentStatus }) =>
    !paymentStatus || row.payment_status === paymentStatus
  const current = rowsInPeriod(rows, (row) => row.sale_date, range.from, range.to)
  const shown = current.filter(byStatus)
  const shownFull = full ? full.filter(byStatus) : []


  return (
    <MonthSwipe className="flex flex-col gap-3 md:gap-4">
      <div className="contents">
        <SalesMobileControls
          from={from}
          to={to}
          sourceMajor={sourceMajor}
          sourceSub={sourceSub}
          sourceTree={sourceTree}
          paymentStatus={paymentStatus}
          paymentMethod={paymentMethod}
          summary={summarizeByPaymentStatus(current)}
          periodLabel={periodBadge(view, anchor)}
        />
      </div>

      <ListPeriodView
        view={view}
        anchor={anchor}
        today={today}
        pathname="/sales"
        params={{ ...params }}
        rows={saleMetricRows(shown)}
        keys={SALE_METRIC_KEYS}
        cellLines={({ sums }) => [
          { text: sums.supply.toLocaleString("ko-KR"), className: INCOME_TEXT_CLASS },
          // 빨간 숫자 = 그날 미입금 (PRD 4.4 미입금 빨강)
          ...(sums.unpaid > 0
            ? [{ text: sums.unpaid.toLocaleString("ko-KR"), className: "text-destructive" }]
            : []),
        ]}
        renderCalendar={(cells) => (
          <SalesCalendar anchor={anchor} today={today} cells={cells} sales={shownFull} />
        )}
        rowView={({ count, sums }) => ({
          countText: `${count}건`,
          value: formatKRW(sums.supply),
          details: [
            { text: `입금 ${formatKRW(sums.paid)}`, className: sums.paid > 0 ? PAID_TEXT_CLASS : undefined },
            {
              text: `미입금 ${formatKRW(sums.unpaid)}`,
              className: sums.unpaid > 0 ? "text-destructive" : undefined,
            },
          ],
        })}
      />
    </MonthSwipe>
  )
}
