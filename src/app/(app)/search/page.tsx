import { ChevronLeft, Search } from "lucide-react"
import Link from "next/link"

import { LedgerDayList } from "@/components/ledger/ledger-day-list"
import { Input } from "@/components/ui/input"
import { buildDayBuckets } from "@/lib/ledger"
import {
  normalizeSearchQuery,
  pickSearchTab,
  SEARCH_MAX_LENGTH,
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
 * 결과는 "매출·지출 | 배차" 탭으로 나눠 보여 준다(배차 운임은 장부 합계와 섞지 않는다).
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; tab?: string | string[] }>
}) {
  const params = await searchParams
  const query = normalizeSearchQuery(params.q)

  let body: React.ReactNode = (
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

      body = (
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

          {isTruncated ? (
            <p className="text-xs text-muted-foreground">
              최근 {SEARCH_RESULT_LIMIT}건까지만 보여요. 검색어를 더 자세히 넣어 보세요.
            </p>
          ) : null}

          {tab === "ledger" ? (
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
          )}
        </>
      )
    } catch (error) {
      body = (
        <p className="text-sm text-destructive">
          검색하지 못했습니다:{" "}
          {error instanceof Error ? error.message : "알 수 없는 오류"}
        </p>
      )
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <header className="-mt-1 grid grid-cols-[2.75rem_1fr_2.75rem] items-center">
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

        <form action="/search" role="search" className="relative">
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

        {body}
      </div>
    </div>
  )
}
