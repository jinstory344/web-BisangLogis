"use client"

import { CalendarDays, ChevronDown, X } from "lucide-react"
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
}: {
  period: { from: string; to: string } | null
  today: string
  query: string
  tab: string
}) {
  const router = useRouter()
  const hrefFor = (next: { from: string; to: string } | null) => searchHref(query, tab, next)
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(period?.from ?? "")
  const [to, setTo] = useState(period?.to ?? "")

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

            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">직접 고르기</p>
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
                이 기간으로 보기
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
