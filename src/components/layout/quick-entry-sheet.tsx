"use client"

import { Plus } from "lucide-react"
import Link from "next/link"
import { useRef, useState } from "react"

import { getRecentCopyEntriesAction } from "@/app/(app)/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  QUICK_ENTRY_LABELS,
  type RecentCopyEntry,
} from "@/lib/quick-entry"

type RecentState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; entries: RecentCopyEntry[] }

/**
 * 모바일 하단 탭 가운데 ＋ 버튼과 "빠른 등록" 하단 시트.
 * - 큰 버튼 3개: 매출/배차/지출 새 등록
 * - 최근 건 복사: 세 종류를 통틀어 최근 등록 5건 → [복사]는 /{종류}/new?copy={id}
 *   시트를 열 때마다 서버 액션으로 새로 불러온다(방금 등록한 건도 바로 보이도록).
 */
export function QuickEntrySheet() {
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<RecentState>({ status: "loading" })
  // 빠르게 여닫을 때 늦게 도착한 이전 응답이 최신 상태를 덮어쓰지 않도록 요청 번호를 둔다.
  const requestIdRef = useRef(0)

  function loadRecent() {
    const requestId = ++requestIdRef.current
    setRecent({ status: "loading" })
    getRecentCopyEntriesAction()
      .then((entries) => {
        if (requestId === requestIdRef.current) {
          setRecent({ status: "ready", entries })
        }
      })
      .catch(() => {
        if (requestId === requestIdRef.current) {
          setRecent({ status: "error" })
        }
      })
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) loadRecent()
  }

  function close() {
    setOpen(false)
  }

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
        side="bottom"
        className="max-h-[85svh] gap-3 overflow-y-auto pb-8"
      >
        <SheetHeader className="pb-0">
          <SheetTitle>빠른 등록</SheetTitle>
          <SheetDescription>
            새로 등록하거나 최근 건을 복사해서 등록해요.
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

        <section aria-labelledby="quick-entry-recent-title" className="px-4">
          <h3
            id="quick-entry-recent-title"
            className="mb-2 text-sm font-semibold text-muted-foreground"
          >
            최근 건 복사
          </h3>
          <RecentCopyList
            state={recent}
            onRetry={loadRecent}
            onNavigate={close}
          />
        </section>
      </SheetContent>
    </Sheet>
  )
}

function RecentCopyList({
  state,
  onRetry,
  onNavigate,
}: {
  state: RecentState
  onRetry: () => void
  onNavigate: () => void
}) {
  if (state.status === "loading") {
    return (
      <div
        className="flex flex-col gap-2"
        role="status"
        aria-label="최근 건 불러오는 중"
      >
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
        <span className="text-muted-foreground">
          최근 건을 불러오지 못했어요.
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

  if (state.entries.length === 0) {
    return (
      <p className="rounded-lg border px-3 py-4 text-center text-sm text-muted-foreground">
        최근 등록한 건이 없어요.
      </p>
    )
  }

  return (
    <ul className="divide-y rounded-lg border">
      {state.entries.map((entry) => {
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
