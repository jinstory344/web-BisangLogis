"use client"

import { Check, ChevronDown, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { searchHref, type SearchFilters } from "@/lib/search"
import { cn } from "@/lib/utils"

type Option = { value: string; label: string; hint?: string }

/**
 * 통합검색 조건 칩 두 번째: 지출 탭이면 [항목 ▾](지출 소분류), 그 밖이면 [거래처 ▾].
 * 매출 탭에는 [미입금만]도 붙는다. 고르면 칩이 "우영로지스 ✕"처럼 바뀌고 ✕로 푼다.
 */
export function TargetFilter({
  query,
  tab,
  period,
  filters,
  clients,
  categories,
}: {
  query: string
  tab: string
  period: { from: string; to: string } | null
  filters: SearchFilters
  clients: { id: string; name: string }[]
  categories: { major: string; minor: string }[]
}) {
  const [open, setOpen] = useState(false)
  const isExpense = tab === "expense"
  const href = (next: SearchFilters) => searchHref(query, tab, period, next)

  const options: Option[] = isExpense
    ? categories.map((c) => ({ value: c.minor, label: c.minor, hint: c.major }))
    : clients.map((c) => ({ value: c.id, label: c.name }))
  const selected = isExpense ? filters.category : filters.clientId
  const selectedLabel = isExpense ? filters.category : filters.clientName
  const placeholder = isExpense ? "항목" : "거래처"

  function nextFilters(option: Option): SearchFilters {
    return isExpense
      ? { ...filters, clientId: undefined, clientName: undefined, category: option.value }
      : { ...filters, category: undefined, clientId: option.value, clientName: option.label }
  }
  const cleared: SearchFilters = isExpense
    ? { ...filters, category: undefined }
    : { ...filters, clientId: undefined, clientName: undefined }

  return (
    <>
      <div className="flex items-center">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-9 max-w-40 items-center gap-1 rounded-full px-3.5 text-sm",
                selected ? "rounded-r-none bg-foreground pr-2 font-semibold text-background" : "bg-muted text-foreground"
              )}
            >
              <span className="truncate">{selected ? selectedLabel || placeholder : placeholder}</span>
              {selected ? null : <ChevronDown className="size-4 shrink-0" />}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="max-h-[50vh] w-56 overflow-y-auto p-1">
            {options.map((option) => (
              <Link
                key={option.value}
                href={href(nextFilters(option))}
                replace
                scroll={false}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-md px-3 text-[15px] active:bg-muted",
                  option.value === selected && "font-semibold"
                )}
              >
                <Check className={cn("size-4 shrink-0", option.value === selected ? "opacity-100" : "opacity-0")} />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.hint ? <span className="text-xs text-muted-foreground">{option.hint}</span> : null}
              </Link>
            ))}
          </PopoverContent>
        </Popover>
        {selected ? (
          <Link
            href={href(cleared)}
            replace
            scroll={false}
            aria-label={`${placeholder} 풀기`}
            className="inline-flex h-9 items-center rounded-r-full bg-foreground pr-3 pl-1 text-background"
          >
            <X className="size-4" />
          </Link>
        ) : null}
      </div>

      {tab === "sale" ? (
        <Link
          href={href({ ...filters, unpaid: filters.unpaid ? undefined : true })}
          replace
          scroll={false}
          aria-pressed={Boolean(filters.unpaid)}
          className={cn(
            "inline-flex h-9 items-center rounded-full px-3.5 text-sm",
            filters.unpaid ? "bg-foreground font-semibold text-background" : "bg-muted text-foreground"
          )}
        >
          미입금만
        </Link>
      ) : null}
    </>
  )
}
