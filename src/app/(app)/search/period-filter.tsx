"use client"

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PERIOD_PRESETS, periodLabel, presetRange, searchHref } from "@/lib/search"
import { cn } from "@/lib/utils"

/**
 * 통합검색 기간 칩: 누르면 아래 판에서 빠른 기간(전체·이번 달·지난달·최근 3개월·올해·작년)이나
 * 시작~끝 날짜를 고른다. 고른 기간은 칩에 "10/20 ~ 11/15 ✕"처럼 남고 ✕로 바로 푼다.
 */
export function PeriodFilter({
  period,
  today,
  query,
  tab,
  monthCounts = {},
}: {
  period: { from: string; to: string } | null
  today: string
  query: string
  tab: string
  /** 달별 건수 {"2026-11": 13} — 월별 막대 (기간과 상관없이 지금 검색어·탭 기준) */
  monthCounts?: Record<string, number>
}) {
  const router = useRouter()
  const hrefFor = (next: { from: string; to: string } | null) => searchHref(query, tab, next)
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(period?.from ?? "")
  const [to, setTo] = useState(period?.to ?? "")
  const [year, setYear] = useState(Number((period?.to ?? today).slice(0, 4)))
  /** 막대를 한 번 누른 상태(시작 달), 두 번째로 누르면 끝 달 */
  const [pendingMonth, setPendingMonth] = useState<string | null>(null)

  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`)
  const maxCount = Math.max(1, ...months.map((m) => monthCounts[m] ?? 0))

  function pickMonth(month: string) {
    const start = pendingMonth && pendingMonth <= month ? pendingMonth : month
    const end = pendingMonth && pendingMonth <= month ? month : pendingMonth ?? month
    const [ey, em] = end.split("-").map(Number)
    setFrom(`${start}-01`)
    setTo(new Date(Date.UTC(ey, em, 0)).toISOString().slice(0, 10))
    setPendingMonth(pendingMonth ? null : month)
  }

  // 고른 범위가 달 단위면 막대 건수를 더해 버튼에 미리 보여 준다
  const isWholeMonths = /-01$/.test(from) && to !== "" && to === new Date(Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)), 0)).toISOString().slice(0, 10)
  const previewCount = isWholeMonths
    ? Object.entries(monthCounts).reduce((sum, [m, n]) => (m >= from.slice(0, 7) && m <= to.slice(0, 7) ? sum + n : sum), 0)
    : null

  function apply(next: { from: string; to: string } | null) {
    setOpen(false)
    router.replace(hrefFor(next), { scroll: false })
  }

  const label = periodLabel(period, today)

  return (
    <>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => {
            setFrom(period?.from ?? "")
            setTo(period?.to ?? "")
            setPendingMonth(null)
            setOpen(true)
          }}
          className={cn(
            "inline-flex h-9 items-center gap-1 rounded-full px-3.5 text-sm",
            period ? "rounded-r-none bg-foreground pr-2 font-semibold text-background" : "bg-muted text-foreground"
          )}
        >
          <CalendarDays className="size-4" />
          {label}
          {period ? null : <ChevronDown className="size-4" />}
        </button>
        {period ? (
          <Link
            href={hrefFor(null)}
            replace
            scroll={false}
            aria-label="기간 풀기"
            className="inline-flex h-9 items-center rounded-r-full bg-foreground pr-3 pl-1 text-background"
          >
            <X className="size-4" />
          </Link>
        ) : null}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="gap-0 pb-6">
          <SheetHeader>
            <SheetTitle>기간</SheetTitle>
            <SheetDescription className="sr-only">빠른 기간을 누르거나 날짜를 직접 고르세요.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            <div className="grid grid-cols-3 gap-2">
              {PERIOD_PRESETS.map((preset) => {
                const range = presetRange(preset.value, today)
                const isOn =
                  (range === null && period === null) ||
                  (range !== null && period?.from === range.from && period?.to === range.to)
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => apply(range)}
                    className={cn(
                      "h-11 rounded-xl text-sm",
                      isOn ? "bg-foreground font-semibold text-background" : "bg-muted"
                    )}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>

            {/* 월별 막대: 높이 = 그 달 건수. 시작 달·끝 달을 차례로 누르면 범위 */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <button type="button" aria-label="이전 해" onClick={() => setYear(year - 1)} className="flex size-9 items-center justify-center rounded-full text-muted-foreground">
                  <ChevronLeft className="size-5" />
                </button>
                <span className="text-sm font-semibold">{year}년</span>
                <button type="button" aria-label="다음 해" onClick={() => setYear(year + 1)} className="flex size-9 items-center justify-center rounded-full text-muted-foreground">
                  <ChevronRight className="size-5" />
                </button>
              </div>
              <div className="grid h-24 grid-cols-12 items-end gap-1">
                {months.map((m) => {
                  const n = monthCounts[m] ?? 0
                  const selected = from !== "" && to !== "" && m >= from.slice(0, 7) && m <= to.slice(0, 7)
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-label={`${Number(m.slice(5))}월 ${n}건`}
                      onClick={() => pickMonth(m)}
                      className="flex h-full items-end"
                    >
                      <span
                        className={cn(
                          "w-full rounded-t-[4px]",
                          selected ? "bg-red-400" : pendingMonth === m ? "bg-red-300" : "bg-muted-foreground/30"
                        )}
                        style={{ height: `${Math.max(4, (n / maxCount) * 100)}%` }}
                      />
                    </button>
                  )
                })}
              </div>
              <div className="grid grid-cols-12 gap-1 text-center text-[10px] text-muted-foreground">
                {months.map((m) => (
                  <span key={m}>{Number(m.slice(5))}월</span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {pendingMonth ? "끝 달을 누르세요 (같은 달을 누르면 그 달만)" : "막대 높이는 그 달 건수예요. 시작 달과 끝 달을 차례로 누르세요."}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">날짜까지 정하기</p>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  aria-label="시작일"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-11 min-w-0 flex-1 text-base"
                />
                <span className="text-muted-foreground">~</span>
                <Input
                  type="date"
                  aria-label="종료일"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-11 min-w-0 flex-1 text-base"
                />
              </div>
              <Button
                type="button"
                className="h-12 text-base"
                disabled={!from || !to}
                onClick={() => apply(from <= to ? { from, to } : { from: to, to: from })}
              >
                {from && to
                  ? `${periodLabel(from <= to ? { from, to } : { from: to, to: from }, today)}${previewCount !== null ? ` · ${previewCount}건` : ""} 보기`
                  : "이 기간으로 보기"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
