import { LedgerDayList } from "@/components/ledger/ledger-day-list"
import { LedgerNav } from "@/components/ledger/ledger-nav"
import { LedgerRangeList } from "@/components/ledger/ledger-range-list"
import { LedgerSummary } from "@/components/ledger/ledger-summary"
import { LedgerViewTabs } from "@/components/ledger/ledger-view-tabs"
import { LedgerKindChips } from "@/components/ledger/ledger-kind-chips"
import { getTodayInSeoul } from "@/lib/date"
import {
  buildDayBuckets,
  buildMonthBuckets,
  buildWeekBuckets,
  buildYearBuckets,
  filterLedgerEntries,
  getLedgerRange,
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
    <div className="p-4 md:p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">비상</h1>

        <LedgerViewTabs view={view} anchor={anchor} />
        <LedgerNav view={view} anchor={anchor} />

        {errorMessage ? (
          <p className="text-sm text-destructive">
            비상을 불러오지 못했습니다: {errorMessage}
          </p>
        ) : (
          <>
            <LedgerSummary totals={totals} unpaid={unpaid} />
            {view === "day" ? (
              <LedgerKindChips anchor={anchor} value={kind} />
            ) : null}
            {content}
          </>
        )}
      </div>
    </div>
  )
}
