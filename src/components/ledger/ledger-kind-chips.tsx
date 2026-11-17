"use client"

import { Check, ChevronDown } from "lucide-react"
import { useState } from "react"

import { UNDER_STICKY_HEAD } from "@/components/layout/sticky-head"
import { MonthBadge } from "@/components/list/month-badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { LEDGER_KIND_FILTERS, type LedgerKindFilter } from "@/lib/ledger"
import { cn } from "@/lib/utils"

/**
 * 일일 장부 거르기 한 줄 (배차 목록과 같은 모양): 왼쪽 "11월 전체 84건", 오른쪽 [전체 ▾] 펼침 목록.
 * 이미 받아 둔 그 달 내역을 화면에서 바로 거르므로 서버를 다시 부르지 않는다.
 * 위 고정 머리 바로 밑에 붙어 함께 고정된다. 날짜 줄(z-10)이 밀려 올라올 때 이 줄 아래로 들어가게 한 층 위(z-20).
 * 위 머리(z-30)가 1px 겹친 자리를 덮어 합계 줄 아래 선이 남고, 이 줄 아래 선은 스크롤해도 같이 붙어 있다.
 */
export function LedgerKindChips({
  value,
  onChange,
  counts,
  monthLabel,
}: {
  value: LedgerKindFilter
  onChange: (next: LedgerKindFilter) => void
  /** 거르기마다 건수 */
  counts: Record<LedgerKindFilter, number>
  /** 보고 있는 달 (예: "11월") */
  monthLabel: string
}) {
  const [open, setOpen] = useState(false)
  const selected = LEDGER_KIND_FILTERS.find((f) => f.value === value) ?? LEDGER_KIND_FILTERS[0]
  const isFiltered = value !== "all"

  return (
    <nav
      aria-label="보기 거르기"
      className={cn(
        "sticky z-20 -mx-4 flex min-h-[52px] items-center justify-between gap-2 border-b bg-background px-4 py-2 text-sm text-muted-foreground md:-mx-6 md:px-6",
        UNDER_STICKY_HEAD
      )}
    >
      <span className="flex min-w-0 items-center truncate">
        <MonthBadge label={monthLabel} />
        <span className="font-semibold text-foreground">{selected.label}</span>&nbsp;{counts[value]}건
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-[13px]",
              isFiltered ? "bg-foreground font-semibold text-background" : "bg-muted text-foreground"
            )}
          >
            {selected.label}
            <ChevronDown className="size-4 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-1">
          {LEDGER_KIND_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={filter.value === value}
              onClick={() => {
                onChange(filter.value)
                setOpen(false)
              }}
              className={cn(
                "flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-[15px] active:bg-muted",
                filter.value === value && "font-semibold"
              )}
            >
              <Check className={cn("size-4 shrink-0", filter.value === value ? "opacity-100" : "opacity-0")} />
              <span className="min-w-0 flex-1">{filter.label}</span>
              <span className="text-sm text-muted-foreground tabular-nums">{counts[filter.value]}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </nav>
  )
}
