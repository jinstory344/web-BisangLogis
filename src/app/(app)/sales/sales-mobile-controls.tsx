"use client"

import { SlidersHorizontal } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { PAID_TEXT_CLASS } from "@/components/dispatches/payment-badge"
import { DateRangeInputs } from "@/components/list/date-range-inputs"
import { StickyHead } from "@/components/layout/sticky-head"
import { LIST_PAGE_HEAD_PX, LIST_SUB_STICKY_CLASS } from "@/components/list/list-page-head"
import { ListPickerRow } from "@/components/list/list-picker-row"
import { TotalsRow } from "@/components/list/totals-row"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants/payment-method"
import type { SaleSourceTree } from "@/lib/constants/sale-sources"
import { SOURCE_MAJOR_OPTIONS } from "@/lib/constants/source"
import { isAllPeriod, isFullMonthRange } from "@/lib/date"
import { formatKRW } from "@/lib/money"
import type { StatusSummary } from "@/lib/sales-list"
import { cn } from "@/lib/utils"

interface SalesMobileControlsProps {
  from: string
  to: string
  /**
   * 달력·주별·월별·연별 보기에서 거르기 줄 왼쪽 배지("11월"/"2026년", 연별은 "" = 배지 없음). 있으면 기간은 보기가 정하므로
   * 기간 직접 지정 칸을 숨기고 거르기 수에도 넣지 않는다.
   */
  periodLabel?: string
  sourceMajor: string
  /** 출처 하위분류 (카카오톡 › 스마일 등) */
  sourceSub: string
  /** 출처 목록 (DB) — 대분류·하위분류 선택지 */
  sourceTree: SaleSourceTree
  paymentStatus: string
  paymentMethod: string
  /** 기간·출처·지불방법 필터 안에서 입금여부와 상관없이 센 요약 */
  summary: StatusSummary
}

const STATUS_CHIPS = [
  { value: "", label: "전체", key: "all" },
  { value: "UNPAID", label: "미입금", key: "unpaid" },
  { value: "PAID", label: "입금완료", key: "paid" },
] as const

/**
 * 모바일 매출 목록 상단: 요약(매출/입금/미입금) · "전체 N건 + 입금 상태 펼침 목록" · 접히는 자세한 필터.
 * 금액은 전부 공급가액 기준이다.
 * 데스크톱은 기존 SalesFilters를 그대로 쓴다.
 */
export function SalesMobileControls({
  from,
  to,
  periodLabel,
  sourceMajor,
  sourceSub,
  sourceTree,
  paymentStatus,
  paymentMethod,
  summary,
}: SalesMobileControlsProps) {
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
  // 기간 직접 지정, 출처, 지불방법 중 하나라도 걸려 있으면 필터 버튼에 표시한다.
  const activeFilterCount =
    (isMonth ? 0 : 1) + (sourceMajor ? 1 : 0) + (sourceSub ? 1 : 0) + (paymentMethod ? 1 : 0)
  const subOptions = sourceTree.find((node) => node.major === sourceMajor)?.minors ?? []
  const [isFilterOpen, setIsFilterOpen] = useState(activeFilterCount > 0)

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

  const unpaid = summary.unpaid.supplyAmount

  return (
    // contents: 자식들이 목록 영역의 직접 자식처럼 놓여서 아래 고정 영역이 목록 끝까지 붙어 있을 수 있다
    <div className="contents">
      {/* 위에 고정: 달 이동 + 합계 줄 (공급가액 기준) */}
      <StickyHead topPx={LIST_PAGE_HEAD_PX} className={LIST_SUB_STICKY_CLASS}>
        <TotalsRow
          items={[
            { label: "매출", value: formatKRW(summary.all.supplyAmount) },
            {
              label: "입금",
              value: formatKRW(summary.paid.supplyAmount),
              className: summary.paid.supplyAmount > 0 ? PAID_TEXT_CLASS : undefined,
            },
            {
              label: "미입금",
              value: formatKRW(unpaid),
              className: unpaid > 0 ? "text-destructive" : undefined,
            },
          ]}
          size="lg"
        />
        {/* 입금 상태 칩 줄 대신 "전체 28건 + [입금 상태 ▾]" (칩 줄을 밀면 화면 전체가 밀리던 문제) */}
        <ListPickerRow
          prefix={monthPrefix}
          placeholder="입금 상태"
          value={paymentStatus}
          options={STATUS_CHIPS.map((chip) => ({
            value: chip.value,
            label: chip.label,
            count: summary[chip.key].count,
            href: hrefWith({ payment_status: chip.value }),
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
      </StickyHead>

      {isFilterOpen ? (
        <div className="flex flex-col gap-3 rounded-xl border p-3">
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={sourceMajor || "ALL"}
              onValueChange={(value) =>
                // 대분류를 바꾸면 하위분류는 새로 고른다
                pushParams({ source_major: value === "ALL" ? "" : value, source_sub: "" })
              }
            >
              <SelectTrigger className="h-11 w-full" aria-label="출처">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">출처 전체</SelectItem>
                {(sourceTree.length > 0 ? sourceTree.map((node) => node.major) : SOURCE_MAJOR_OPTIONS).map((major) => (
                  <SelectItem key={major} value={major}>
                    {major}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={paymentMethod || "ALL"}
              onValueChange={(value) =>
                pushParams({ payment_method: value === "ALL" ? "" : value })
              }
            >
              <SelectTrigger className="h-11 w-full" aria-label="지불방법">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">지불방법 전체</SelectItem>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 대분류에 하위분류가 있으면(카카오톡 › 스마일 등) 그다음 칸으로 고른다 */}
          {subOptions.length > 0 ? (
            <Select
              value={sourceSub || "ALL"}
              onValueChange={(value) => pushParams({ source_sub: value === "ALL" ? "" : value })}
            >
              <SelectTrigger className="h-11 w-full" aria-label="출처 하위분류">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{sourceMajor} 전체</SelectItem>
                {subOptions.map((sub) => (
                  <SelectItem key={sub} value={sub}>
                    {sub}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {/* 달력·주별·월별·연별 보기는 기간을 보기가 정하므로 기간 직접 지정 칸이 없다 */}
          {periodLabel !== undefined ? null : (
            <>
              {/* 달을 넘기면 입력값도 새 기간으로 바뀌도록 기간이 바뀔 때 새로 만든다. */}
              <DateRangeInputs
                key={`${from}_${to}`}
                from={isAllPeriod({ from, to }) ? "" : from}
                to={isAllPeriod({ from, to }) ? "" : to}
                onApply={(range) => pushParams(range)}
              />
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
