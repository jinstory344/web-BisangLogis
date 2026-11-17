import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense, type ReactNode } from "react"

import {
  EXPENSE_TEXT_CLASS,
  INCOME_TEXT_CLASS,
} from "@/components/ledger/colors"
import { TotalsRow } from "@/components/list/totals-row"
import { formatLiters } from "@/lib/fuel"
import { getTodayInSeoul } from "@/lib/date"
import { formatKRW } from "@/lib/money"
import {
  countByMonth,
  filtersForTab,
  hasFilters,
  inPeriod,
  normalizeSearchQuery,
  parseSearchFilters,
  parseSmartQuery,
  periodLabel,
  parseSearchPeriod,
  parseSearchTab,
  SEARCH_TABS,
  searchHref,
  type SearchTab,
} from "@/lib/search"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

import { SEARCH_RESULT_LIMIT, searchLedgerAmounts, searchLedgerEntries } from "../ledger-data"

import { PeriodFilter } from "./period-filter"
import { QuickCards } from "./quick-cards"
import { RememberSearch } from "./recent-searches"
import { SearchBox } from "./search-box"

import { EntityCards } from "./entity-cards"
import {
  searchClientIds,
  searchDispatchAmounts,
  searchDispatches,
  searchEntities,
  searchPeople,
} from "./search-data"
import { SearchResultList, type SearchItem } from "./search-result-list"
import { TargetFilter } from "./target-filter"

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
    client_id?: string | string[]
    client_name?: string | string[]
    category?: string | string[]
    unpaid?: string | string[]
    contact?: string | string[]
    person?: string | string[]
  }>
}) {
  const params = await searchParams
  const query = normalizeSearchQuery(params.q)
  const tab = parseSearchTab(params.tab)
  const period = parseSearchPeriod(params.from, params.to)
  const today = getTodayInSeoul()
  const filters = parseSearchFilters(params)

  // 조건 칩 목록(거래처·지출 항목)과 말로 검색에 쓰는 이름들
  const supabaseForLists = await createClient()
  const [clientsRes, categoriesRes] = await Promise.all([
    supabaseForLists.from("clients").select("id, name").is("deleted_at", null).order("name"),
    supabaseForLists.from("expense_categories").select("major, minor, sort_order").is("deleted_at", null).not("minor", "is", null).order("sort_order"),
  ])
  const clientOptions = clientsRes.data ?? []
  const categoryOptions = (categoriesRes.data ?? []).map((c) => ({ major: c.major, minor: c.minor as string }))

  // 말로 검색: "우영 2026 매출" → 거래처·연도·탭 칩으로 바꾼 주소로 다시 연다
  if (query) {
    const smart = parseSmartQuery(query, {
      today,
      clients: clientOptions,
      categories: categoryOptions.map((c) => c.minor),
    })
    if (smart) {
      const nextTab = smart.tab ?? tab
      redirect(
        searchHref(smart.query, nextTab, smart.period ?? period, filtersForTab(nextTab, { ...filters, ...smart.filters }))
      )
    }
  }

  let monthCounts: Record<string, number> = {}
  const chips = (counts?: Record<string, number>) => (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <PeriodFilter
        period={period}
        today={today}
        query={query}
        tab={tab}
        monthCounts={counts}
        filters={filters}
      />
      <TargetFilter
        query={query}
        tab={tab}
        period={period}
        filters={filters}
        clients={clientOptions}
        categories={categoryOptions}
      />
    </div>
  )
  // 매출·지출·배차·전체 탭 줄 (검색 전에는 건수 없이 — 누르면 그 종류 전체 기간 합계가 나온다)
  const tabNav = (counts?: Record<SearchTab, number>) => (
    <nav
      aria-label="검색 결과 종류"
      className="grid grid-cols-4 gap-1.5 border-b pt-1 pb-2.5"
    >
      {SEARCH_TABS.map((item) => {
        const isActive = item.value === tab
        return (
          <Link
            key={item.value}
            href={searchHref(query, item.value, period, filtersForTab(item.value, filters))}
            replace
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              // 네 칸이 한 줄을 똑같이 나눠 쓴다 (건수가 붙어도 줄이 바뀌지 않게)
              "inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-full px-2 text-sm whitespace-nowrap",
              // 고른 탭만 흰 바탕·검은 글씨 (아래 회색 조건 칩과 구별)
              isActive ? "bg-foreground font-semibold text-background" : "bg-muted text-muted-foreground"
            )}
          >
            {item.label}
            {counts ? (
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  isActive ? "text-background/70" : "text-muted-foreground"
                )}
              >
                {counts[item.value]}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
  let fixedPart: ReactNode = (
    <>
      {tabNav()}
      {chips()}
    </>
  )
  // 아무것도 안 쳤을 때: 이번 달 숫자가 보이는 빠른 조건 + 최근에 찾은 조건
  let list: ReactNode = (
    <Suspense
      fallback={
        <div aria-hidden className="flex flex-col gap-2 pt-8">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      }
    >
      <QuickCards />
    </Suspense>
  )

  // 검색어가 없어도 매출·지출·배차 탭을 고르면 그 종류 전체(기간 칩이 없으면 전체 기간)를 보여 준다
  if (query || period || hasFilters(filters) || tab !== "all") {
    try {
      const supabase = await createClient()
      const clientIds = query ? await searchClientIds(supabase, query) : []
      const [ledger, dispatch, amounts, dispatchAmounts, entities] = await Promise.all([
        searchLedgerEntries(supabase, query, clientIds, period, filters),
        searchDispatches(supabase, query, clientIds, period, filters),
        searchLedgerAmounts(supabase, query, clientIds, filters),
        searchDispatchAmounts(supabase, query, clientIds, filters),
        query || filters.clientId
          ? searchEntities(supabase, query || filters.clientName || "")
          : Promise.resolve({ clients: [], vehicles: [] }),
      ])
      const people = query ? await searchPeople(supabase, query) : []
      // 합계·건수는 목록(최근 몇백 건)이 아니라 조건에 맞는 전부로, 기간은 여기서 거른다
      const saleIn = amounts.sale.filter((r) => inPeriod(r.date, period))
      const expenseIn = amounts.expense.filter((r) => inPeriod(r.date, period))
      const dispatchIn = dispatchAmounts.filter((r) => inPeriod(r.date, period))

      const sales = ledger.entries.filter((e) => e.kind === "sale")
      const expenses = ledger.entries.filter((e) => e.kind === "expense")
      const counts: Record<SearchTab, number> = {
        all: saleIn.length + expenseIn.length + dispatchIn.length,
        sale: saleIn.length,
        expense: expenseIn.length,
        dispatch: dispatchIn.length,
      }
      // 기간 판의 월별 막대: 기간과 상관없이 지금 탭 종류의 달별 건수
      monthCounts = countByMonth(
        [
          ...(tab === "all" || tab === "sale" ? amounts.sale : []),
          ...(tab === "all" || tab === "expense" ? amounts.expense : []),
          ...(tab === "all" || tab === "dispatch" ? dispatchAmounts : []),
        ].map((r) => r.date)
      )

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

      const sum = (rows: { amount: number }[]) => rows.reduce((total, r) => total + r.amount, 0)
      const saleTotal = sum(saleIn)
      const unpaidTotal = sum(saleIn.filter((r) => r.unpaid))
      const expenseTotal = sum(expenseIn)
      // 주유비·요소수에 적은 리터 합 (적은 건이 있을 때만 칸을 보인다)
      const literTotal = Math.round(expenseIn.reduce((t, r) => t + Number(r.liters ?? 0), 0) * 10) / 10
      const literItem = literTotal > 0 ? [{ label: "리터", value: formatLiters(literTotal) }] : []
      const dispatchTotals = { freight: sum(dispatchIn), fee: dispatchIn.reduce((t, r) => t + r.fee, 0) }
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
                ...literItem,
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
                  ...literItem,
                ]

      const isTruncated = ledger.isTruncated || dispatch.isTruncated
      const tabLabel = SEARCH_TABS.find((t) => t.value === tab)?.label ?? ""

      fixedPart = (
        <>
          <EntityCards vehicles={entities.vehicles} />
          {/* 동명이인: 검색어가 들어간 이름이 둘 이상이면 사람별로 나눠 보기 */}
          {people.length > 1 ? (
            <div className="flex flex-wrap gap-1.5 pb-2">
              {[null, ...people].map((p) => {
                const isOn = (filters.person ?? null) === (p?.name ?? null)
                return (
                  <Link
                    key={p?.name ?? "all"}
                    href={searchHref(query, tab, period, { ...filters, person: p?.name })}
                    replace
                    scroll={false}
                    className={cn(
                      "inline-flex h-9 items-center gap-1 rounded-full px-3.5 text-sm",
                      isOn ? "bg-foreground font-semibold text-background" : "bg-muted text-foreground"
                    )}
                  >
                    {p ? p.name : "모두"}
                    {p ? (
                      <span className={cn("text-xs", isOn ? "text-background/70" : "text-muted-foreground")}>
                        {p.roles.join("·")}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          ) : null}

          {tabNav(counts)}

          {chips(monthCounts)}

          <TotalsRow items={totals} />

          {isTruncated ? (
            <p className="py-1 text-center text-[11px] text-muted-foreground">
              목록은 종류마다 최근 {SEARCH_RESULT_LIMIT}건까지만 보여요(합계·건수는 전부 기준).
              기간이나 검색어로 좁혀 보세요.
            </p>
          ) : null}
        </>
      )

      const what = query ? `"${query}"(으)로 찾은 ` : "이 조건의 "
      const recentLabel =
        [
          query,
          filters.clientName,
          filters.category,
          period ? periodLabel(period, today) : null,
          filters.unpaid ? "미입금만" : null,
          filters.contact ? `담당 ${filters.contact}` : null,
          filters.person && filters.person !== query ? filters.person : null,
        ]
          .filter(Boolean)
          .join(" · ") || "전체"
      list = (
        <>
        {/* 탭만 고른 것(조건 없음)은 '최근에 찾은 조건'에 남기지 않는다 */}
        {query || period || hasFilters(filters) ? (
          <RememberSearch
            search={{ href: searchHref(query, tab, period, filters), label: recentLabel, kind: tabLabel }}
          />
        ) : null}
        <SearchResultList
          items={items}
          clientNameMap={dispatch.clientNameMap}
          emptyMessage={`${what}${tab === "all" ? "결과가" : `${tabLabel}이(가)`} 없습니다.`}
        />
        </>
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

          <SearchBox query={query} tab={tab} period={period} filters={filters} />

          {fixedPart}
        </div>

        {list}
      </div>
    </div>
  )
}
