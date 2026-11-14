"use client"

import { Check, ChevronDown } from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useState } from "react"

import { LIST_SUB_STICKY_CLASS } from "@/components/list/list-page-head"
import { TotalsRow } from "@/components/list/totals-row"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { DispatchSummary } from "@/lib/dispatch-list"
import { formatKRW } from "@/lib/money"
import { cn } from "@/lib/utils"

interface DispatchMobileControlsProps {
  clientId: string
  clientName: string
  /** 기간 안의 전체 배차 요약 (거래처 필터와 상관없이 센 것) */
  summary: DispatchSummary
  /** 거래처 id → 이름 (칩 이름용) */
  clientNames: Record<string, string>
}

/**
 * 모바일 배차 목록 상단: 요약(건수/운임/수수료) · 건수 + 거래처 펼침 목록.
 * 목록은 이 기간에 배차가 많은 거래처부터, 이름 옆에 건수. 데스크톱은 기존 DispatchFilters를 그대로 쓴다.
 */
export function DispatchMobileControls({
  clientId,
  clientName,
  summary,
  clientNames,
}: DispatchMobileControlsProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)

  function hrefWith(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value)
      else params.delete(key)
    })
    params.delete("page")
    return `${pathname}?${params.toString()}`
  }

  function nameOf(id: string): string {
    return clientNames[id] || (id === clientId ? clientName : "") || "거래처"
  }

  const options = [
    { clientId: "", label: "전체", count: summary.count },
    ...summary.byClient.map((client) => ({
      clientId: client.clientId,
      label: nameOf(client.clientId),
      count: client.count,
    })),
  ]
  // 고른 거래처가 이 달에 배차가 없어도(다른 달에서 넘어옴) 목록에 남겨 풀 수 있게
  if (clientId && !options.some((o) => o.clientId === clientId)) {
    options.push({ clientId, label: nameOf(clientId), count: 0 })
  }
  const selected = options.find((o) => o.clientId === clientId) ?? options[0]

  return (
    // contents: 자식들이 목록 영역의 직접 자식처럼 놓여서 아래 고정 영역이 목록 끝까지 붙어 있을 수 있다
    <div className="contents">
      {/* 위에 고정: 합계 줄 (달 이동은 위 머리에 있다) */}
      <div className={LIST_SUB_STICKY_CLASS}>
        <TotalsRow
          items={[
            { label: "배차", value: `${summary.count}건` },
            { label: "운임", value: formatKRW(summary.freightAmount) },
            { label: "수수료", value: formatKRW(summary.feeAmount) },
          ]}
          size="lg"
        />
      </div>

      {/* 거래처 칩 줄 대신 건수 + 거래처 펼침 목록 하나 (칩 줄을 밀면 화면 전체가 같이 밀리던 문제) */}
      <div className="flex min-h-10 items-center justify-between text-sm text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{selected.label}</span> {selected.count}건
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-9 max-w-[60%] items-center gap-1 rounded-full px-3.5 text-sm",
                clientId ? "bg-foreground font-semibold text-background" : "bg-muted text-foreground"
              )}
            >
              <span className="truncate">{clientId ? selected.label : "거래처"}</span>
              <ChevronDown className="size-4 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="max-h-[60vh] w-56 overflow-y-auto p-1">
            {options.map((option) => (
              <Link
                key={option.clientId || "all"}
                prefetch
                replace
                scroll={false}
                href={hrefWith({
                  client_id: option.clientId,
                  client_name: option.clientId ? option.label : "",
                })}
                onClick={() => setOpen(false)}
                aria-current={option.clientId === clientId ? "true" : undefined}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-md px-3 text-[15px] active:bg-muted",
                  option.clientId === clientId && "font-semibold"
                )}
              >
                <Check
                  className={cn("size-4 shrink-0", option.clientId === clientId ? "opacity-100" : "opacity-0")}
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <span className="text-sm text-muted-foreground tabular-nums">{option.count}</span>
              </Link>
            ))}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
