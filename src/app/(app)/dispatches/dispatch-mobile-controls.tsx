"use client"

import { SlidersHorizontal } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import type { ClientSearchResult } from "@/app/(app)/clients/actions"
import { ClientCombobox } from "@/components/clients/client-combobox"
import { DateRangeInputs } from "@/components/list/date-range-inputs"
import { LIST_SUB_STICKY_CLASS } from "@/components/list/list-page-head"
import { ListPickerRow } from "@/components/list/list-picker-row"
import { TotalsRow } from "@/components/list/totals-row"
import { isAllPeriod, isFullMonthRange } from "@/lib/date"
import type { DispatchSummary } from "@/lib/dispatch-list"
import { formatKRW } from "@/lib/money"
import { cn } from "@/lib/utils"

interface DispatchMobileControlsProps {
  from: string
  to: string
  clientId: string
  clientName: string
  /** 기간 안의 전체 배차 요약 (거래처 필터와 상관없이 센 것) */
  summary: DispatchSummary
  /** 거래처 id → 이름 (목록 이름용) */
  clientNames: Record<string, string>
}

/**
 * 모바일 배차 목록 상단: 요약(건수/운임/수수료) · "전체 N건 + 거래처 펼침 목록" · 접히는 자세한 필터.
 * 펼침 목록은 이 기간에 배차가 많은 거래처부터 이름 옆에 건수. 필터 안에는 목록에 없는 거래처 찾기와 기간 직접 지정.
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

  // 전체 기간(HOME 미입금 줄에서 들어옴)은 직접 지정한 기간 필터로 세지 않는다
  const isMonth = isFullMonthRange({ from, to }) || isAllPeriod({ from, to })
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

  function nameOf(id: string): string {
    return clientNames[id] || (id === clientId ? clientName : "") || "거래처"
  }

  const options = [
    { value: "", label: "전체", count: summary.count },
    ...summary.byClient.map((client) => ({
      value: client.clientId,
      label: nameOf(client.clientId),
      count: client.count,
    })),
  ]
  // 고른 거래처가 이 달에 배차가 없어도(다른 달에서 넘어옴) 목록에 남겨 풀 수 있게
  if (clientId && !options.some((o) => o.value === clientId)) {
    options.push({ value: clientId, label: nameOf(clientId), count: 0 })
  }

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

      <ListPickerRow
        placeholder="거래처"
        value={clientId}
        options={options.map((o) => ({
          ...o,
          href: hrefWith({ client_id: o.value, client_name: o.value ? o.label : "" }),
        }))}
        trailing={
          <button
            type="button"
            aria-expanded={isFilterOpen}
            aria-label={`자세한 필터${activeFilterCount > 0 ? ` ${activeFilterCount}개 사용 중` : ""}`}
            onClick={() => setIsFilterOpen((open) => !open)}
            className={cn(
              "relative flex size-9 items-center justify-center rounded-full",
              activeFilterCount > 0 ? "bg-foreground text-background" : "bg-muted text-foreground"
            )}
          >
            <SlidersHorizontal className="size-4" />
          </button>
        }
      />

      {isFilterOpen ? (
        <div className="flex flex-col gap-3 rounded-xl border p-3">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">목록에 없는 거래처는 이름으로 찾으세요.</p>
            <ClientCombobox
              value={searchedClient}
              onChange={(next) => {
                setSearchedClient(next)
                router.push(hrefWith({ client_id: next?.id ?? "", client_name: next?.name ?? "" }))
              }}
            />
          </div>

          {/* 달을 넘기면 입력값도 새 기간으로 바뀌도록 기간이 바뀔 때 새로 만든다. */}
          <DateRangeInputs
            key={`${from}_${to}`}
            from={isAllPeriod({ from, to }) ? "" : from}
            to={isAllPeriod({ from, to }) ? "" : to}
            onApply={(range) => router.push(hrefWith(range))}
          />
        </div>
      ) : null}
    </div>
  )
}
