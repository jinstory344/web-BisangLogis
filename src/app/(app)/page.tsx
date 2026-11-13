
import { SearchButton } from "@/components/layout/search-button"
import { LedgerDayList } from "@/components/ledger/ledger-day-list"
import { LedgerNav } from "@/components/ledger/ledger-nav"
import { LedgerRangeList } from "@/components/ledger/ledger-range-list"
import { LedgerSummary, UnpaidLine } from "@/components/ledger/ledger-summary"
import { LedgerViewTabs } from "@/components/ledger/ledger-view-tabs"
import { SwipePager } from "@/components/ledger/swipe-pager"
import { LedgerKindChips } from "@/components/ledger/ledger-kind-chips"
import { getTodayInSeoul } from "@/lib/date"
import {
  buildDayBuckets,
  buildMonthBuckets,
  buildWeekBuckets,
  buildYearBuckets,
  filterLedgerEntries,
  getLedgerNeighborAnchors,
  getLedgerRange,
  ledgerHref,
  parseAnchorDate,
  parseLedgerKind,
  parseLedgerView,
  sumTotals,
} from "@/lib/ledger"
import { createClient } from "@/lib/supabase/server"

import {
  fetchAmountRows,
  fetchLedgerEntries,
  fetchUnpaidSummary,
} from "./ledger-data"

interface LedgerSearchParams {
  view?: string
  d?: string
  kind?: string
}

/**
 * 장부(홈): 매출(공급가액)과 지출을 한곳에서 보고 남은 돈을 확인한다.
 * 일일(그 달의 날짜별 내역) · 주별 · 월별 · 연별로 바꿔 볼 수 있고, 기본은 일일이다.
 * 배차의 운임·수수료는 매출과 따로 관리해서 여기에 넣지 않는다.
 */
export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<LedgerSearchParams>
}) {
  const params = await searchParams
  const today = getTodayInSeoul()
  const view = parseLedgerView(params.view)
  const anchor = parseAnchorDate(params.d, today)
  const range = getLedgerRange(view, anchor)
  const kind = parseLedgerKind(params.kind)
  const neighbors = getLedgerNeighborAnchors(view, anchor)

  const supabase = await createClient()

  let content: React.ReactNode
  let totals = { income: 0, expense: 0, net: 0 }
  let unpaid = { count: 0, supplyAmount: 0 }
  let errorMessage: string | null = null

  try {
    const [unpaidSummary, body] = await Promise.all([
      fetchUnpaidSummary(supabase),
      (async () => {
        if (view === "day") {
          const entries = await fetchLedgerEntries(supabase, range.from, range.to)
          return {
            totals: sumTotals(
              entries.map((entry) => ({
                date: entry.date,
                income: entry.kind === "sale" ? entry.amount : 0,
                expense: entry.kind === "expense" ? entry.amount : 0,
              }))
            ),
            node: (
              <LedgerDayList
                buckets={buildDayBuckets(filterLedgerEntries(entries, kind))}
              />
            ),
          }
        }

        const rows = await fetchAmountRows(supabase, range.from, range.to)
        const buckets =
          view === "week"
            ? buildWeekBuckets(anchor, rows, today)
            : view === "month"
              ? buildMonthBuckets(Number(anchor.slice(0, 4)), rows, today)
              : buildYearBuckets(rows, today)
        return {
          totals: sumTotals(rows),
          node: <LedgerRangeList view={view} buckets={buckets} />,
        }
      })(),
    ])
    unpaid = unpaidSummary
    totals = body.totals
    content = body.node
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "알 수 없는 오류"
    content = null
  }

  return (
    <div className="px-4 pb-4 md:px-6 md:pb-6">
      <div className="mx-auto max-w-2xl">
        <SwipePager
          prevHref={neighbors ? ledgerHref(view, neighbors.prev, kind) : null}
          nextHref={neighbors ? ledgerHref(view, neighbors.next, kind) : null}
          className="flex flex-col"
        >
          {/* 위에 고정되는 부분: 목록을 내려도 제목·날짜·보기 탭·합계·미입금이 계속 보인다 */}
          <div className="sticky top-0 z-20 -mx-4 bg-background px-4 pt-2 md:-mx-6 md:px-6 md:pt-6">
            {/* 가계부 앱처럼: 왼쪽 검색 · 가운데 제목 */}
            <header className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
              <SearchButton />
              <h1 className="text-center text-lg font-semibold tracking-tight">비상</h1>
              <span aria-hidden />
            </header>

            <LedgerNav view={view} anchor={anchor} kind={kind} />
            <LedgerViewTabs view={view} anchor={anchor} />
            {errorMessage ? null : (
              <>
                <LedgerSummary totals={totals} />
                <UnpaidLine unpaid={unpaid} />
              </>
            )}
          </div>

          {errorMessage ? (
            <p className="py-3 text-sm text-destructive">
              비상을 불러오지 못했습니다: {errorMessage}
            </p>
          ) : (
            <>
              {view === "day" ? (
                <LedgerKindChips anchor={anchor} value={kind} />
              ) : null}
              {content}
            </>
          )}
        </SwipePager>
      </div>
    </div>
  )
}
