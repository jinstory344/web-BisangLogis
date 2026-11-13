import { ChevronLeft, Search } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { EXPENSE_TEXT_CLASS, INCOME_TEXT_CLASS } from "@/components/ledger/colors"
import { LedgerDayList } from "@/components/ledger/ledger-day-list"
import { Input } from "@/components/ui/input"
import { buildDayBuckets, sumTotals } from "@/lib/ledger"
import { formatKRW } from "@/lib/money"
import {
  normalizeSearchQuery,
  pickSearchTab,
  SEARCH_MAX_LENGTH,
  sumDispatchTotals,
  type SearchTab,
} from "@/lib/search"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

import { SEARCH_RESULT_LIMIT, searchLedgerEntries } from "../ledger-data"

import { searchClientIds, searchDispatches } from "./search-data"
import { SearchDispatchList } from "./search-dispatch-list"

/**
 * 검색: 기간과 상관없이 매출·지출·배차를 글자로 찾는다 (비상 화면 왼쪽 위 돋보기).
 * 매출은 상차지·하차지·출처·계산서정보·비고·거래처, 지출은 분류·사용처·비고,
 * 배차는 상차지·하차지·차량번호·기사·담당자·배차자·비고·거래처에서 찾는다.
 * 결과는 "매출·지출 | 배차" 탭으로 나눠 보여 주고(배차 운임은 장부 합계와 섞지 않는다),
 * 제목·검색창·탭·찾은 건 합계는 위에 고정되어 목록을 내려도 계속 보인다(가계부 앱처럼).
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; tab?: string | string[] }>
}) {
  const params = await searchParams
  const query = normalizeSearchQuery(params.q)

  let fixedPart: ReactNode = null
  let list: ReactNode = (
    <p className="py-12 text-center text-sm text-muted-foreground">
      지명·거래처·차량번호·기사·분류·비고로 매출·지출·배차를 찾아요.
    </p>
  )

  if (query) {
    try {
      const supabase = await createClient()
      const clientIds = await searchClientIds(supabase, query)
      const [ledger, dispatch] = await Promise.all([
        searchLedgerEntries(supabase, query, clientIds),
        searchDispatches(supabase, query, clientIds),
      ])
      const tab = pickSearchTab(
        params.tab,
        ledger.entries.length,
        dispatch.dispatches.length
      )
      const isTruncated =
        tab === "ledger" ? ledger.isTruncated : dispatch.isTruncated
      const tabs: { value: SearchTab; label: string; count: number }[] = [
        { value: "ledger", label: "매출·지출", count: ledger.entries.length },
        { value: "dispatch", label: "배차", count: dispatch.dispatches.length },
      ]
      const emptyMessage = `"${query}"(으)로 찾은 ${
        tab === "ledger" ? "매출·지출이" : "배차가"
      } 없습니다.`

      const ledgerTotals = sumTotals(
        ledger.entries.map((entry) => ({
          date: entry.date,
          income: entry.kind === "sale" ? entry.amount : 0,
          expense: entry.kind === "expense" ? entry.amount : 0,
        }))
      )
      const dispatchTotals = sumDispatchTotals(dispatch.dispatches)

      fixedPart = (
        <>
          <nav
            aria-label="검색 결과 종류"
            className="-mx-4 grid grid-cols-2 border-b px-2 md:mx-0 md:px-0"
          >
            {tabs.map((item) => {
              const isActive = item.value === tab
              return (
                <Link
                  key={item.value}
                  href={`/search?q=${encodeURIComponent(query)}&tab=${item.value}`}
                  replace
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-11 items-center justify-center gap-1 px-3 text-[15px] whitespace-nowrap",
                    isActive
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {item.count}
                  </span>
                  {isActive ? (
                    <span
                      aria-hidden
                      className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-red-400"
                    />
                  ) : null}
                </Link>
              )
            })}
          </nav>

          {/* 찾은 건 합계 (가계부 앱의 수입·지출·이체 줄처럼) */}
          {tab === "ledger" ? (
            <SearchTotals
              items={[
                {
                  label: "매출",
                  value: formatKRW(ledgerTotals.income),
                  className: INCOME_TEXT_CLASS,
                },
                {
                  label: "지출",
                  value: formatKRW(ledgerTotals.expense),
                  className: EXPENSE_TEXT_CLASS,
                },
                {
                  label: "합계",
                  value: formatKRW(ledgerTotals.net),
                  className:
                    ledgerTotals.net < 0 ? EXPENSE_TEXT_CLASS : INCOME_TEXT_CLASS,
                },
              ]}
            />
          ) : (
            <SearchTotals
              items={[
                { label: "건수", value: `${dispatch.dispatches.length}건` },
                { label: "운임", value: formatKRW(dispatchTotals.freight) },
                { label: "수수료", value: formatKRW(dispatchTotals.fee) },
              ]}
            />
          )}

          {isTruncated ? (
            <p className="py-1.5 text-center text-xs text-muted-foreground">
              최근 {SEARCH_RESULT_LIMIT}건까지만 보여요(합계도 이 건들 기준). 검색어를
              더 자세히 넣어 보세요.
            </p>
          ) : null}
        </>
      )

      list =
        tab === "ledger" ? (
          <LedgerDayList
            buckets={buildDayBuckets(ledger.entries)}
            emptyMessage={emptyMessage}
          />
        ) : (
          <SearchDispatchList
            dispatches={dispatch.dispatches}
            clientNameMap={dispatch.clientNameMap}
            emptyMessage={emptyMessage}
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
        {/* 위에 고정되는 부분: 목록을 내려도 제목·검색창·탭·합계가 그대로 보인다 */}
        <div className="sticky top-0 z-20 -mx-4 bg-background px-4 pt-3 md:-mx-6 md:px-6 md:pt-6">
          <header className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center">
            <Link
              href="/"
              aria-label="비상으로 돌아가기"
              className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-6" />
            </Link>
            <h1 className="text-center text-lg font-semibold tracking-tight">검색</h1>
            <span aria-hidden />
          </header>

          <form action="/search" role="search" className="relative mt-2 mb-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              name="q"
              defaultValue={query}
              // 처음 들어왔을 때만 바로 입력할 수 있게 (결과를 볼 때 키보드가 가리지 않도록)
              autoFocus={!query}
              maxLength={SEARCH_MAX_LENGTH}
              enterKeyHint="search"
              placeholder="예: 평택, 주유, 거래처, 차량번호"
              aria-label="검색어"
              className="h-11 pl-9 text-base"
            />
          </form>

          {fixedPart}
        </div>

        {list}
      </div>
    </div>
  )
}

/** 고정 영역 아래쪽의 합계 한 줄: 세 칸에 이름(작게)과 금액 */
function SearchTotals({
  items,
}: {
  items: { label: string; value: string; className?: string }[]
}) {
  return (
    <dl className="-mx-4 grid grid-cols-3 border-b px-2 py-2.5 md:mx-0 md:px-0">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col items-center gap-0.5">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              "max-w-full truncate text-[15px] font-semibold tabular-nums",
              item.className
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
