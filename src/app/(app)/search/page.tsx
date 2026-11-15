import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import {
  EXPENSE_TEXT_CLASS,
  INCOME_TEXT_CLASS,
} from "@/components/ledger/colors"
import { TotalsRow } from "@/components/list/totals-row"
import { getTodayInSeoul } from "@/lib/date"
import { formatKRW } from "@/lib/money"
import {
  normalizeSearchQuery,
  parseSearchPeriod,
  parseSearchTab,
  SEARCH_TABS,
  searchHref,
  type SearchTab,
} from "@/lib/search"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

import { SEARCH_RESULT_LIMIT, searchLedgerEntries, searchLedgerTotals } from "../ledger-data"

import { PeriodFilter } from "./period-filter"
import { SearchBox } from "./search-box"
import { searchClientIds, searchDispatches, searchDispatchTotals } from "./search-data"
import { SearchResultList, type SearchItem } from "./search-result-list"

/**
 * 통합검색: 매출·지출·배차를 글자와 기간으로 찾는다 (비상 화면 왼쪽 위 돋보기).
 * 탭 [전체·매출·지출·배차]로 종류를 고르고(전체는 날짜순으로 섞음), 기간 칩으로 빠른 기간이나 날짜를 고른다.
 * 결과는 달별로 묶어 접고 펼친다. 제목·검색창·탭·기간·합계는 위에 고정된다.
 * 글자 없이 기간만으로도 찾을 수 있다(예: 작년 전체).
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[]
    tab?: string | string[]
    from?: string | string[]
    to?: string | string[]
  }>
}) {
  const params = await searchParams
  const query = normalizeSearchQuery(params.q)
  const tab = parseSearchTab(params.tab)
  const period = parseSearchPeriod(params.from, params.to)
  const today = getTodayInSeoul()

  let fixedPart: ReactNode = (
    <div className="flex items-center gap-2 pb-2">
      <PeriodFilter period={period} today={today} query={query} tab={tab} />
    </div>
  )
  let list: ReactNode = (
    <p className="py-12 text-center text-sm text-muted-foreground">
      지명·거래처·차량번호·차주·분류·비고로 찾거나,
      <br />
      기간만 골라서 그 기간의 매출·지출·배차를 모아 볼 수 있어요.
    </p>
  )

  if (query || period) {
    try {
      const supabase = await createClient()
      const clientIds = query ? await searchClientIds(supabase, query) : []
      const [ledger, dispatch, ledgerTotals, dispatchTotals] = await Promise.all([
        searchLedgerEntries(supabase, query, clientIds, period),
        searchDispatches(supabase, query, clientIds, period),
        searchLedgerTotals(supabase, query, clientIds, period),
        searchDispatchTotals(supabase, query, clientIds, period),
      ])

      const sales = ledger.entries.filter((e) => e.kind === "sale")
      const expenses = ledger.entries.filter((e) => e.kind === "expense")
      // 건수·합계는 목록(최근 몇백 건)이 아니라 조건에 맞는 전부로 센다
      const counts: Record<SearchTab, number> = {
        all: ledgerTotals.sale.count + ledgerTotals.expense.count + dispatchTotals.count,
        sale: ledgerTotals.sale.count,
        expense: ledgerTotals.expense.count,
        dispatch: dispatchTotals.count,
      }

      const items: SearchItem[] = [
        ...(tab === "all" || tab === "sale" ? sales : []).map((entry) => ({
          kind: "ledger" as const,
          date: entry.date,
          createdAt: entry.createdAt,
          entry,
        })),
        ...(tab === "all" || tab === "expense" ? expenses : []).map((entry) => ({
          kind: "ledger" as const,
          date: entry.date,
          createdAt: entry.createdAt,
          entry,
        })),
        ...(tab === "all" || tab === "dispatch" ? dispatch.dispatches : []).map((row) => ({
          kind: "dispatch" as const,
          date: row.dispatch_date,
          createdAt: row.created_at,
          dispatch: row,
        })),
      ]

      const saleTotal = ledgerTotals.sale.amount
      const unpaidTotal = ledgerTotals.sale.unpaid
      const expenseTotal = ledgerTotals.expense.amount
      const totals =
        tab === "sale"
          ? [
              { label: "매출", value: formatKRW(saleTotal), className: INCOME_TEXT_CLASS },
              { label: "미입금", value: formatKRW(unpaidTotal), className: "text-destructive" },
              { label: "건수", value: `${counts.sale}건` },
            ]
          : tab === "expense"
            ? [
                { label: "지출", value: formatKRW(expenseTotal), className: EXPENSE_TEXT_CLASS },
                { label: "건수", value: `${counts.expense}건` },
              ]
            : tab === "dispatch"
              ? [
                  { label: "건수", value: `${counts.dispatch}건` },
                  { label: "운임", value: formatKRW(dispatchTotals.freight) },
                  { label: "수수료", value: formatKRW(dispatchTotals.fee) },
                ]
              : [
                  { label: "매출", value: formatKRW(saleTotal), className: INCOME_TEXT_CLASS },
                  { label: "지출", value: formatKRW(expenseTotal), className: EXPENSE_TEXT_CLASS },
                  { label: "배차 운임", value: formatKRW(dispatchTotals.freight) },
                ]

      const isTruncated = ledger.isTruncated || dispatch.isTruncated
      const tabLabel = SEARCH_TABS.find((t) => t.value === tab)?.label ?? ""

      fixedPart = (
        <>
          <nav
            aria-label="검색 결과 종류"
            className="-mx-4 grid grid-cols-4 border-b px-2 md:mx-0 md:px-0"
          >
            {SEARCH_TABS.map((item) => {
              const isActive = item.value === tab
              return (
                <Link
                  key={item.value}
                  href={searchHref(query, item.value, period)}
                  replace
                  scroll={false}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-10 items-center justify-center gap-1 px-1 text-sm whitespace-nowrap",
                    isActive ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {counts[item.value]}
                  </span>
                  {isActive ? (
                    <span aria-hidden className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-red-400" />
                  ) : null}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2 py-2">
            <PeriodFilter period={period} today={today} query={query} tab={tab} />
          </div>

          <TotalsRow items={totals} />

          {isTruncated ? (
            <p className="py-1 text-center text-[11px] text-muted-foreground">
              목록은 종류마다 최근 {SEARCH_RESULT_LIMIT}건까지만 보여요(합계·건수는 전부 기준).
              기간이나 검색어로 좁혀 보세요.
            </p>
          ) : null}
        </>
      )

      const what = query ? `"${query}"(으)로 찾은 ` : "이 기간의 "
      list = (
        <SearchResultList
          items={items}
          clientNameMap={dispatch.clientNameMap}
          emptyMessage={`${what}${tab === "all" ? "결과가" : `${tabLabel}이(가)`} 없습니다.`}
        />
      )
    } catch (error) {
      list = (
        <p className="text-sm text-destructive">
          검색하지 못했습니다:{" "}
          {error instanceof Error ? error.message : "알 수 없는 오류"}
        </p>
      )
    }
  }

  return (
    <div className="px-4 pb-4 md:px-6 md:pb-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        {/* 위에 고정되는 부분: 목록을 내려도 제목·검색창·탭·기간·합계가 그대로 보인다 */}
        <div className="sticky top-0 z-20 -mx-4 bg-background px-4 pt-3 md:-mx-6 md:px-6 md:pt-6">
          <header className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center">
            <Link
              href="/"
              aria-label="HOME으로 돌아가기"
              className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-6" />
            </Link>
            <h1 className="text-center text-lg font-semibold tracking-tight">검색</h1>
            <span aria-hidden />
          </header>

          <SearchBox query={query} tab={tab} period={period} />

          {fixedPart}
        </div>

        {list}
      </div>
    </div>
  )
}
