"use client"

import { SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import type { ClientSearchResult } from "@/app/(app)/clients/actions"
import { ClientCombobox } from "@/components/clients/client-combobox"
import { chipVariants } from "@/components/form/choice-chips"
import { DateRangeInputs } from "@/components/list/date-range-inputs"
import { MonthNavigator } from "@/components/list/month-navigator"
import { isFullMonthRange } from "@/lib/date"
import { pickClientChips, type DispatchSummary } from "@/lib/dispatch-list"
import { formatKRW } from "@/lib/money"
import { cn } from "@/lib/utils"

interface DispatchMobileControlsProps {
  from: string
  to: string
  clientId: string
  clientName: string
  /** 기간 안의 전체 배차 요약 (거래처 필터와 상관없이 센 것) */
  summary: DispatchSummary
  /** 거래처 id → 이름 (칩 이름용) */
  clientNames: Record<string, string>
}

/**
 * 모바일 배차 목록 상단: 달 이동 · 요약(건수/운임/수수료) · 거래처 칩 · 접히는 필터.
 * 칩은 이 기간에 배차가 많은 거래처부터 보여 주고, 칩에 없는 거래처는 필터 안의 검색으로 고른다.
 * 데스크톱은 기존 DispatchFilters를 그대로 쓴다.
 */
export function DispatchMobileControls({
  from,
  to,
  clientId,
  clientName,
  summary,
  clientNames,
}: DispatchMobileControlsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isMonth = isFullMonthRange({ from, to })
  // 기간 직접 지정이 걸려 있으면 필터 버튼에 표시한다 (거래처는 칩으로 보이므로 세지 않는다).
  const activeFilterCount = isMonth ? 0 : 1
  const [isFilterOpen, setIsFilterOpen] = useState(activeFilterCount > 0)
  const [searchedClient, setSearchedClient] = useState<ClientSearchResult | null>(
    clientId ? { id: clientId, name: clientName, biz_no: null } : null
  )

  function hrefWith(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value)
      else params.delete(key)
    })
    params.delete("page")
    return `${pathname}?${params.toString()}`
  }

  function pushParams(next: Record<string, string>) {
    router.push(hrefWith(next))
  }

  function nameOf(id: string): string {
    return clientNames[id] || (id === clientId ? clientName : "") || "거래처"
  }

  const chips = [
    { clientId: "", label: "전체", count: summary.count },
    ...pickClientChips(summary.byClient, clientId).map((client) => ({
      clientId: client.clientId,
      label: nameOf(client.clientId),
      count: client.count,
    })),
  ]

  return (
    <div className="flex flex-col gap-3">
      <MonthNavigator
        from={from}
        to={to}
        hrefForRange={(range) => hrefWith({ ...range })}
      />

      <div className="rounded-xl border p-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-xs text-muted-foreground">배차</p>
            <p className="text-base font-semibold tabular-nums">
              {summary.count}건
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">운임</p>
            <p className="text-base font-semibold tabular-nums">
              {formatKRW(summary.freightAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">수수료</p>
            <p className="text-base font-semibold tabular-nums">
              {formatKRW(summary.feeAmount)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="no-scrollbar -ml-4 flex min-w-0 flex-1 gap-2 overflow-x-auto py-0.5 pl-4 [contain:inline-size]">
          {chips.map((chip) => (
            <Link
              key={chip.clientId || "all"}
              href={hrefWith({
                client_id: chip.clientId,
                client_name: chip.clientId ? chip.label : "",
              })}
              aria-current={clientId === chip.clientId ? "true" : undefined}
              className={chipVariants({ selected: clientId === chip.clientId })}
            >
              {chip.label} {chip.count}
            </Link>
          ))}
        </div>
        <button
          type="button"
          aria-expanded={isFilterOpen}
          onClick={() => setIsFilterOpen((open) => !open)}
          className={cn(
            chipVariants({ selected: activeFilterCount > 0 }),
            "shrink-0"
          )}
        >
          <SlidersHorizontal />
          필터{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
        </button>
      </div>

      {isFilterOpen ? (
        <div className="flex flex-col gap-3 rounded-xl border p-3">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">
              칩에 없는 거래처는 이름으로 찾으세요.
            </p>
            <ClientCombobox
              value={searchedClient}
              onChange={(next) => {
                setSearchedClient(next)
                pushParams({
                  client_id: next?.id ?? "",
                  client_name: next?.name ?? "",
                })
              }}
            />
          </div>

          {/* 달을 넘기면 입력값도 새 기간으로 바뀌도록 기간이 바뀔 때 새로 만든다. */}
          <DateRangeInputs
            key={`${from}_${to}`}
            from={from}
            to={to}
            onApply={(range) => pushParams(range)}
          />
        </div>
      ) : null}
    </div>
  )
}
