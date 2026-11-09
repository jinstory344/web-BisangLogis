"use client"

import { Plus, Search, X } from "lucide-react"
import Link from "next/link"
import { useMemo, useRef, useState } from "react"

import { getCopyCandidatesAction } from "@/app/(app)/actions"
import { ChoiceChips, type ChoiceOption } from "@/components/form/choice-chips"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { quickCreateNavItems } from "@/lib/constants/nav"
import { formatMonthDay } from "@/lib/date"
import { formatKRW } from "@/lib/money"
import {
  getCopyHref,
  pickFrequentCandidates,
  QUICK_ENTRY_LABELS,
  QUICK_ENTRY_ORDER,
  QUICK_LIST_MAX,
  QUICK_LIST_PAGE_SIZE,
  QUICK_LIST_STEP,
  searchCandidates,
  type CopyCandidate,
  type FrequentCopyEntry,
  type QuickKindFilter,
} from "@/lib/quick-entry"

type CandidatesState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; candidates: CopyCandidate[] }

const KIND_FILTER_OPTIONS: ChoiceOption<QuickKindFilter>[] = [
  { value: "all", label: "전체" },
  ...QUICK_ENTRY_ORDER.map((kind) => ({
    value: kind,
    label: QUICK_ENTRY_LABELS[kind],
  })),
]

/**
 * 모바일 하단 탭 가운데 ＋ 버튼과 "빠른 등록" 하단 시트.
 * - 큰 버튼 3개: 매출/지출/배차 새 등록
 * - 이전 건 복사: [복사]는 /{종류}/new?copy={id}
 *   · 자주 쓰는 건: 같은 구간·분류로 2번 이상 등록한 건을 횟수 순으로
 *   · 최근 건: 5건부터 "더 보기"로 늘려 볼 수 있음
 *   · 검색: 구간·거래처·출처·분류·차량번호·기사명·메모·금액, 종류 필터
 *   시트를 열 때마다 후보 목록을 서버에서 새로 불러오고(방금 등록한 건도 바로 보이도록),
 *   검색·묶음은 기기에서 처리해 글자를 칠 때마다 결과가 바로 바뀐다.
 */
export function QuickEntrySheet() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<CandidatesState>({ status: "loading" })
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState<QuickKindFilter>("all")
  const [visibleCount, setVisibleCount] = useState(QUICK_LIST_PAGE_SIZE)
  // 빠르게 여닫을 때 늦게 도착한 이전 응답이 최신 상태를 덮어쓰지 않도록 요청 번호를 둔다.
  const requestIdRef = useRef(0)
  const contentRef = useRef<HTMLDivElement>(null)

  function load() {
    const requestId = ++requestIdRef.current
    setState({ status: "loading" })
    getCopyCandidatesAction()
      .then((candidates) => {
        if (requestId === requestIdRef.current) {
          setState({ status: "ready", candidates })
        }
      })
      .catch(() => {
        if (requestId === requestIdRef.current) {
          setState({ status: "error" })
        }
      })
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setQuery("")
      setKind("all")
      setVisibleCount(QUICK_LIST_PAGE_SIZE)
      load()
    }
  }

  function close() {
    setOpen(false)
  }

  const trimmedQuery = query.trim()
  const searching = trimmedQuery !== ""
  const candidates = useMemo(
    () => (state.status === "ready" ? state.candidates : []),
    [state]
  )

  const frequent = useMemo(
    () => (searching ? [] : pickFrequentCandidates(candidates, { kind })),
    [candidates, kind, searching]
  )
  const listed = useMemo(
    () =>
      searchCandidates(candidates, {
        kind,
        query: trimmedQuery,
        limit: visibleCount,
      }),
    [candidates, kind, trimmedQuery, visibleCount]
  )

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="빠른 등록"
          className="group flex flex-1 items-center justify-center outline-none"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform group-focus-visible:ring-3 group-focus-visible:ring-ring/50 group-active:scale-95">
            <Plus className="size-6" aria-hidden />
          </span>
        </button>
      </SheetTrigger>
      <SheetContent
        ref={contentRef}
        side="bottom"
        className="max-h-[85svh] gap-3 overflow-y-auto pb-8"
        // 시트를 열 때 라이브러리가 링크를 건너뛰고 처음 만나는 입력칸(검색창)에 포커스를 주면
        // 폰에서 키보드가 바로 올라온다. 검색창을 직접 눌렀을 때만 키보드가 뜨도록 자동 포커스를
        // 막고, 포커스는 시트 자체에 둔다(시트 안에서 키보드 이동·포커스 가둠은 그대로 동작).
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          contentRef.current?.focus({ preventScroll: true })
        }}
      >
        <SheetHeader className="pb-0">
          <SheetTitle>빠른 등록</SheetTitle>
          <SheetDescription>
            새로 등록하거나, 이전 건을 찾아 복사해서 등록해요.
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-2 px-4">
          {quickCreateNavItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border bg-muted/40 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"
              >
                <Icon className="size-6" aria-hidden />
                {item.label}
              </Link>
            )
          })}
        </div>

        <div className="flex flex-col gap-2 px-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setVisibleCount(QUICK_LIST_PAGE_SIZE)
              }}
              placeholder="구간·거래처·출처·분류로 이전 건 검색"
              aria-label="이전 건 검색"
              className="h-11 pr-11 pl-9"
            />
            {query ? (
              <button
                type="button"
                aria-label="검색어 지우기"
                onClick={() => {
                  setQuery("")
                  setVisibleCount(QUICK_LIST_PAGE_SIZE)
                }}
                className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>

          <ChoiceChips<QuickKindFilter>
            options={KIND_FILTER_OPTIONS}
            value={kind}
            onChange={(next) => {
              setKind(next)
              setVisibleCount(QUICK_LIST_PAGE_SIZE)
            }}
            aria-label="종류 필터"
          />
        </div>

        <CandidateSections
          state={state}
          searching={searching}
          frequent={frequent}
          listedEntries={listed.entries}
          listedTotal={listed.total}
          hasAnyCandidate={candidates.length > 0}
          onShowMore={() =>
            setVisibleCount((count) =>
              Math.min(count + QUICK_LIST_STEP, QUICK_LIST_MAX)
            )
          }
          onRetry={load}
          onNavigate={close}
        />
      </SheetContent>
    </Sheet>
  )
}

function CandidateSections({
  state,
  searching,
  frequent,
  listedEntries,
  listedTotal,
  hasAnyCandidate,
  onShowMore,
  onRetry,
  onNavigate,
}: {
  state: CandidatesState
  searching: boolean
  frequent: FrequentCopyEntry[]
  listedEntries: CopyCandidate[]
  listedTotal: number
  hasAnyCandidate: boolean
  onShowMore: () => void
  onRetry: () => void
  onNavigate: () => void
}) {
  if (state.status === "loading") {
    return (
      <div
        className="flex flex-col gap-2 px-4"
        role="status"
        aria-label="이전 건 불러오는 중"
      >
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="mx-4 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
        <span className="text-muted-foreground">
          이전 건을 불러오지 못했어요.
        </span>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0"
          onClick={onRetry}
        >
          다시 시도
        </Button>
      </div>
    )
  }

  const remaining = Math.max(listedTotal - listedEntries.length, 0)
  const canShowMore =
    remaining > 0 && listedEntries.length < QUICK_LIST_MAX

  return (
    <>
      {!searching ? (
        <section aria-labelledby="quick-entry-frequent-title" className="px-4">
          <h3
            id="quick-entry-frequent-title"
            className="mb-2 text-sm font-semibold text-muted-foreground"
          >
            자주 쓰는 건
          </h3>
          {frequent.length > 0 ? (
            <CopyList entries={frequent} onNavigate={onNavigate} />
          ) : (
            <p className="rounded-lg border px-3 py-3 text-center text-xs text-muted-foreground">
              같은 구간·분류로 2번 이상 등록하면 여기에 모여요.
            </p>
          )}
        </section>
      ) : null}

      <section aria-labelledby="quick-entry-list-title" className="px-4">
        <h3
          id="quick-entry-list-title"
          className="mb-2 text-sm font-semibold text-muted-foreground"
        >
          {searching ? `검색 결과 ${listedTotal}건` : "최근 건"}
        </h3>
        {listedEntries.length === 0 ? (
          <p className="rounded-lg border px-3 py-4 text-center text-sm text-muted-foreground">
            {searching
              ? "일치하는 건이 없어요."
              : hasAnyCandidate
                ? "이 종류로 등록한 건이 없어요."
                : "아직 등록한 건이 없어요."}
          </p>
        ) : (
          <CopyList entries={listedEntries} onNavigate={onNavigate} />
        )}
        {canShowMore ? (
          <Button
            type="button"
            variant="outline"
            className="mt-2 h-11 w-full"
            onClick={onShowMore}
          >
            더 보기 ({remaining}건 남음)
          </Button>
        ) : null}
        {remaining > 0 && !canShowMore ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {QUICK_LIST_MAX}건까지만 보여줘요. 검색으로 좁혀보세요.
          </p>
        ) : null}
      </section>
    </>
  )
}

function CopyList({
  entries,
  onNavigate,
}: {
  entries: (CopyCandidate & { count?: number })[]
  onNavigate: () => void
}) {
  return (
    <ul className="divide-y rounded-lg border">
      {entries.map((entry) => {
        const kindLabel = QUICK_ENTRY_LABELS[entry.kind]
        const dateLabel = formatMonthDay(entry.date)
        const amountLabel =
          entry.amount === null ? "-" : formatKRW(entry.amount)

        return (
          <li
            key={`${entry.kind}:${entry.id}`}
            className="flex items-center gap-3 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant="secondary">{kindLabel}</Badge>
                <span className="tabular-nums">{dateLabel}</span>
                {entry.count !== undefined ? (
                  <Badge variant="outline">{entry.count}회</Badge>
                ) : null}
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-sm">{entry.summary}</span>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {amountLabel}
                </span>
              </div>
            </div>
            <Button asChild variant="outline" className="h-11 shrink-0 px-4">
              <Link
                href={getCopyHref(entry.kind, entry.id)}
                onClick={onNavigate}
                aria-label={`${kindLabel} ${dateLabel} ${entry.summary} 복사해서 등록`}
              >
                복사
              </Link>
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
