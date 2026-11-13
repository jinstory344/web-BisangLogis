import { cache, Suspense } from "react"

import { SearchButton } from "@/components/layout/search-button"
import { RefreshIfStale } from "@/components/layout/service-worker"
import { LedgerCalendar } from "@/components/ledger/ledger-calendar"
import { LedgerDayView } from "@/components/ledger/ledger-day-view"
import { LedgerNav } from "@/components/ledger/ledger-nav"
import { LedgerRangeList } from "@/components/ledger/ledger-range-list"
import { LedgerSummary, UnpaidLine } from "@/components/ledger/ledger-summary"
import { LedgerViewTabs } from "@/components/ledger/ledger-view-tabs"
import { SwipePager } from "@/components/ledger/swipe-pager"
import { TotalsRow } from "@/components/list/totals-row"
import { getTodayInSeoul } from "@/lib/date"
import {
  buildDayBuckets,
  buildMonthBuckets,
  buildWeekBuckets,
  buildYearBuckets,
  getLedgerNeighborAnchors,
  getLedgerRange,
  ledgerHref,
  parseAnchorDate,
  parseLedgerKind,
  parseLedgerView,
  sumTotals,
  type LedgerKindFilter,
  type LedgerTotals,
  type LedgerView,
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

type LedgerLoad =
  | {
      ok: true
      totals: LedgerTotals
      unpaid: { count: number; supplyAmount: number }
      content: React.ReactNode
    }
  | { ok: false; message: string }

/**
 * HOME 데이터 읽기. 위쪽 합계와 아래 목록이 각각 따로 기다리지만(Suspense 두 곳),
 * cache로 한 요청 안에서는 한 번만 읽는다.
 */
const loadLedger = cache(
  async (
    view: LedgerView,
    anchor: string,
    kind: LedgerKindFilter,
    today: string
  ): Promise<LedgerLoad> => {
    try {
      const supabase = await createClient()
      const range = getLedgerRange(view, anchor)
      const [unpaid, body] = await Promise.all([
        fetchUnpaidSummary(supabase),
        (async () => {
          if (view === "day" || view === "calendar") {
            const entries = await fetchLedgerEntries(supabase, range.from, range.to)
            return {
              totals: sumTotals(
                entries.map((entry) => ({
                  date: entry.date,
                  income: entry.kind === "sale" ? entry.amount : 0,
                  expense: entry.kind === "expense" ? entry.amount : 0,
                }))
              ),
              content:
                view === "calendar" ? (
                  <LedgerCalendar
                    anchor={anchor}
                    today={today}
                    buckets={buildDayBuckets(entries)}
                  />
                ) : (
                  <LedgerDayView anchor={anchor} entries={entries} initialKind={kind} />
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
            content: <LedgerRangeList view={view} buckets={buckets} />,
          }
        })(),
      ])
      return { ok: true, unpaid, ...body }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "알 수 없는 오류",
      }
    }
  }
)

type SlotProps = {
  view: LedgerView
  anchor: string
  kind: LedgerKindFilter
  today: string
}

/** 위에 고정되는 합계 줄 + 미입금 줄 */
async function SummarySlot(props: SlotProps) {
  const result = await loadLedger(props.view, props.anchor, props.kind, props.today)
  if (!result.ok) return null
  return (
    <>
      <LedgerSummary totals={result.totals} />
      <UnpaidLine unpaid={result.unpaid} />
    </>
  )
}

/** 아래 목록(일일·달력·주별·월별·연별) */
async function ContentSlot(props: SlotProps) {
  const result = await loadLedger(props.view, props.anchor, props.kind, props.today)
  if (!result.ok) {
    return (
      <p className="py-3 text-sm text-destructive">
        HOME 화면을 불러오지 못했습니다: {result.message}
      </p>
    )
  }
  return result.content
}

/** 숫자를 읽는 동안 합계 줄 자리를 같은 높이로 비워 둔다 (화면이 들썩이지 않게) */
function SummaryFallback() {
  return (
    <TotalsRow
      size="lg"
      items={[
        { label: "매출", value: " " },
        { label: "지출", value: " " },
        { label: "수익", value: " " },
      ]}
    />
  )
}

function ContentFallback() {
  return (
    <div aria-hidden className="flex flex-col gap-3 pt-3">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-muted/40" />
      ))}
    </div>
  )
}

/**
 * 장부(홈): 매출(공급가액)과 지출을 한곳에서 보고 남은 돈을 확인한다.
 * 일일(그 달의 날짜별 내역) · 달력(날짜 칸마다 합계) · 주별 · 월별 · 연별로 바꿔 볼 수 있고, 기본은 일일이다.
 * 배차의 운임·수수료는 매출과 따로 관리해서 여기에 넣지 않는다.
 *
 * 제목·달·보기 탭은 바로 보내고, 합계와 목록은 데이터를 읽는 대로 이어서 채운다(스트리밍).
 * 홈 화면 앱을 처음 열 때 까만 화면을 오래 보지 않게 하기 위해서다.
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
  const kind = parseLedgerKind(params.kind)
  const neighbors = getLedgerNeighborAnchors(view, anchor)
  // 화면 안 이동(달·보기 바꾸기)은 전환 중에 이전 화면을 그대로 두므로 자리 표시는 처음 열 때만 보인다.
  const slot: SlotProps = { view, anchor, kind, today }
  // 서버가 이 화면을 그린 시각 — 폰에 저장해 둔 옛 화면으로 열렸는지 알아보는 데 쓴다
  const renderedAt = Date.now()

  return (
    <div className="px-4 pb-4 md:px-6 md:pb-6">
      <div className="mx-auto max-w-2xl">
        <RefreshIfStale renderedAt={renderedAt} />
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
              <h1 className="text-center text-lg font-semibold tracking-wide">HOME</h1>
              <span aria-hidden />
            </header>

            <LedgerNav view={view} anchor={anchor} kind={kind} />
            <LedgerViewTabs view={view} anchor={anchor} />
            <Suspense fallback={<SummaryFallback />}>
              <SummarySlot {...slot} />
            </Suspense>
          </div>

          <Suspense fallback={<ContentFallback />}>
            <ContentSlot {...slot} />
          </Suspense>
        </SwipePager>
      </div>
    </div>
  )
}
