"use client"

import { ChevronDown, SlidersHorizontal } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { ClientSheet } from "@/components/clients/client-sheet"
import { DateRangeInputs } from "@/components/list/date-range-inputs"
import { StickyHead } from "@/components/layout/sticky-head"
import { LIST_PAGE_HEAD_PX, LIST_SUB_STICKY_CLASS } from "@/components/list/list-page-head"
import { MonthBadge } from "@/components/list/month-badge"
import { SECTION_COLORS } from "@/lib/constants/section-colors"
import { TotalsRow } from "@/components/list/totals-row"
import { isAllPeriod, isFullMonthRange } from "@/lib/date"
import type { DispatchSummary } from "@/lib/dispatch-list"
import { formatKRW } from "@/lib/money"
import { cn } from "@/lib/utils"

interface DispatchMobileControlsProps {
  from: string
  to: string
  /**
   * 달력·주별·월별·연별 보기에서 거르기 줄 왼쪽 배지("11월"/"2026년", 연별은 "" = 배지 없음). 있으면 기간은 보기가 정하므로
   * 기간 직접 지정 칸을 숨기고 거르기 수에도 넣지 않는다.
   */
  periodLabel?: string
  clientId: string
  clientName: string
  /** 기간 안의 전체 배차 요약 (거래처 필터와 상관없이 센 것) */
  summary: DispatchSummary
  /** 거래처 id → 이름 (목록 이름용) */
  clientNames: Record<string, string>
}

/**
 * 모바일 배차 목록 상단: 요약(건수/운임/수수료) · "전체 N건 + 거래처 펼침 목록" · 접히는 자세한 필터.
 * 거래처 버튼을 누르면 아래에서 거래처 선택판(배차 많은 순, 건수, 배차 없는 거래처도). 필터 안에는 기간 직접 지정.
 * 데스크톱은 기존 DispatchFilters를 그대로 쓴다.
 */
export function DispatchMobileControls({
  from,
  to,
  periodLabel,
  clientId,
  clientName,
  summary,
  clientNames,
}: DispatchMobileControlsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 전체 기간(HOME 미입금 줄에서 들어옴)은 직접 지정한 기간 필터로 세지 않는다
  const isMonth = periodLabel !== undefined || isFullMonthRange({ from, to }) || isAllPeriod({ from, to })
  // 보고 있는 달 ("11월") — "11월 전체 28건"처럼 거르기 줄 왼쪽에 붙인다(한 달이 아닐 때는 없음)
  const monthPrefix =
    periodLabel !== undefined
      ? periodLabel || undefined
      : isFullMonthRange({ from, to })
        ? `${Number(from.slice(5, 7))}월`
        : undefined
  const activeFilterCount = isMonth ? 0 : 1
  const [isFilterOpen, setIsFilterOpen] = useState(activeFilterCount > 0)
  const [isClientSheetOpen, setIsClientSheetOpen] = useState(false)

  function hrefWith(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value)
      else params.delete(key)
    })
    params.delete("page")
    return `${pathname}?${params.toString()}`
  }

  // 묶음(이름 첫 단어가 같은 거래처들)은 client_id에 "a,b"로, client_name에 묶음 이름으로 온다
  const isGroup = clientId.includes(",")

  function nameOf(id: string): string {
    if (isGroup) return clientName || "묶음"
    return clientNames[id] || (id === clientId ? clientName : "") || "거래처"
  }

  const counts = Object.fromEntries(summary.byClient.map((c) => [c.clientId, c.count]))
  const selectedCount = clientId.split(",").reduce((sum, id) => sum + (counts[id] ?? 0), 0)

  return (
    // contents: 자식들이 목록 영역의 직접 자식처럼 놓여서 아래 고정 영역이 목록 끝까지 붙어 있을 수 있다
    <div className="contents">
      {/* 위에 고정: 합계 줄 (달 이동은 위 머리에 있다) */}
      <StickyHead topPx={LIST_PAGE_HEAD_PX} className={cn(LIST_SUB_STICKY_CLASS, SECTION_COLORS.dispatch.line)}>
        <TotalsRow
          items={[
            { label: "배차", value: `${summary.count}건` },
            { label: "운임", value: formatKRW(summary.freightAmount) },
            { label: "수수료", value: formatKRW(summary.feeAmount) },
          ]}
          size="lg"
        />

      <div className="flex min-h-[52px] items-center justify-between gap-2 py-2 text-sm text-muted-foreground">
        <span className="flex min-w-0 items-center truncate">
          {monthPrefix ? <MonthBadge label={monthPrefix} className={SECTION_COLORS.dispatch.badge} /> : null}
          <span className="font-semibold text-foreground">{clientId ? nameOf(clientId) : "전체"}</span>&nbsp;
          {clientId ? selectedCount : summary.count}건
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setIsClientSheetOpen(true)}
            className={cn(
              "inline-flex h-9 max-w-44 items-center gap-1 rounded-full px-3.5 text-[13px]",
              clientId ? SECTION_COLORS.dispatch.chip : "bg-muted text-foreground"
            )}
          >
            <span className="truncate">{clientId ? nameOf(clientId) : "거래처"}</span>
            <ChevronDown className="size-4 shrink-0" />
          </button>
          {periodLabel !== undefined ? null : (
            <button
              type="button"
              aria-expanded={isFilterOpen}
              aria-label={`자세한 필터${activeFilterCount > 0 ? ` ${activeFilterCount}개 사용 중` : ""}`}
              onClick={() => setIsFilterOpen((open) => !open)}
              className={cn(
                "relative flex size-9 items-center justify-center rounded-full",
                activeFilterCount > 0 ? SECTION_COLORS.dispatch.chip : "bg-muted text-foreground"
              )}
            >
              <SlidersHorizontal className="size-4" />
            </button>
          )}
        </div>
      </div>
      </StickyHead>

      <ClientSheet
        open={isClientSheetOpen}
        onOpenChange={setIsClientSheetOpen}
        title="거래처로 보기"
        selectedId={isGroup ? "" : clientId}
        selectedGroup={isGroup ? clientName : undefined}
        onPickGroup={(group) =>
          router.push(hrefWith({ client_id: group.ids.join(","), client_name: group.name }), {
            scroll: false,
          })
        }
        counts={counts}
        allCount={summary.count}
        onPick={(next) =>
          router.push(hrefWith({ client_id: next?.id ?? "", client_name: next?.name ?? "" }), {
            scroll: false,
          })
        }
      />

      {/* 기간 직접 지정만 들어 있어서 달력·주별·월별·연별 보기에는 없다 */}
      {isFilterOpen && periodLabel === undefined ? (
        <div className="flex flex-col gap-3 rounded-xl border p-3">
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
