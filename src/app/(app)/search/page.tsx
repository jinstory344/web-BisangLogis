import { ChevronLeft, Search } from "lucide-react"
import Link from "next/link"

import { LedgerDayList } from "@/components/ledger/ledger-day-list"
import { Input } from "@/components/ui/input"
import { buildDayBuckets } from "@/lib/ledger"
import { normalizeSearchQuery, SEARCH_MAX_LENGTH } from "@/lib/search"
import { createClient } from "@/lib/supabase/server"

import { SEARCH_RESULT_LIMIT, searchLedgerEntries } from "../ledger-data"

/**
 * 검색: 기간과 상관없이 매출·지출을 글자로 찾는다 (비상 화면 왼쪽 위 돋보기).
 * 매출은 상차지·하차지·출처·계산서정보·비고, 지출은 분류·사용처·비고에서 찾는다.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const params = await searchParams
  const query = normalizeSearchQuery(params.q)

  let body: React.ReactNode = (
    <p className="py-12 text-center text-sm text-muted-foreground">
      지명·거래처·분류·비고로 매출과 지출을 찾아요.
    </p>
  )

  if (query) {
    try {
      const supabase = await createClient()
      const { entries, isTruncated } = await searchLedgerEntries(supabase, query)
      body = (
        <>
          <p className="text-xs text-muted-foreground">
            {entries.length}건
            {isTruncated
              ? ` · 최근 ${SEARCH_RESULT_LIMIT}건까지만 보여요. 검색어를 더 자세히 넣어 보세요.`
              : ""}
          </p>
          <LedgerDayList
            buckets={buildDayBuckets(entries)}
            emptyMessage={`"${query}"(으)로 찾은 매출·지출이 없습니다.`}
          />
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
            placeholder="예: 평택, 주유, 거래처 이름"
            aria-label="검색어"
            className="h-11 pl-9 text-base"
          />
        </form>

        {body}
      </div>
    </div>
  )
}
