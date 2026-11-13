"use client"

import { SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { PAID_TEXT_CLASS } from "@/components/dispatches/payment-badge"
import { chipVariants } from "@/components/form/choice-chips"
import { DateRangeInputs } from "@/components/list/date-range-inputs"
import { LIST_CHIP_CLASS, LIST_SUB_STICKY_CLASS } from "@/components/list/list-page-head"
import { TotalsRow } from "@/components/list/totals-row"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants/payment-method"
import { SOURCE_MAJOR_OPTIONS } from "@/lib/constants/source"
import { isFullMonthRange } from "@/lib/date"
import { formatKRW } from "@/lib/money"
import type { StatusSummary } from "@/lib/sales-list"
import { cn } from "@/lib/utils"

interface SalesMobileControlsProps {
  from: string
  to: string
  sourceMajor: string
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
 * 모바일 매출 목록 상단: 달 이동 · 요약(매출/입금/미입금) · 입금여부 칩 · 접히는 필터.
 * 금액은 전부 공급가액 기준이고, 세액을 포함한 합계금액은 요약 아래 한 줄로만 알려 준다.
 * 데스크톱은 기존 SalesFilters를 그대로 쓴다.
 */
export function SalesMobileControls({
  from,
  to,
  sourceMajor,
  paymentStatus,
  paymentMethod,
  summary,
}: SalesMobileControlsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isMonth = isFullMonthRange({ from, to })
  // 기간 직접 지정, 출처, 지불방법 중 하나라도 걸려 있으면 필터 버튼에 표시한다.
  const activeFilterCount =
    (isMonth ? 0 : 1) + (sourceMajor ? 1 : 0) + (paymentMethod ? 1 : 0)
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
      <div className={LIST_SUB_STICKY_CLASS}>
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
      </div>

      <p className="text-xs text-muted-foreground">
        세액 포함 합계금액 {formatKRW(summary.all.totalAmount)}
      </p>

      <div className="flex items-center gap-2">
        <div className="no-scrollbar -ml-4 flex min-w-0 flex-1 gap-2 overflow-x-auto py-0.5 pl-4 [contain:inline-size]">
          {STATUS_CHIPS.map((chip) => (
            <Link
              key={chip.key}
              href={hrefWith({ payment_status: chip.value })}
              aria-current={paymentStatus === chip.value ? "true" : undefined}
              className={cn(chipVariants({ selected: paymentStatus === chip.value }), LIST_CHIP_CLASS)}
            >
              {chip.label} {summary[chip.key].count}
            </Link>
          ))}
        </div>
        <button
          type="button"
          aria-expanded={isFilterOpen}
          onClick={() => setIsFilterOpen((open) => !open)}
          className={cn(
            chipVariants({ selected: activeFilterCount > 0 }),
            LIST_CHIP_CLASS,
            "shrink-0"
          )}
        >
          <SlidersHorizontal />
          필터{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
        </button>
      </div>

      {isFilterOpen ? (
        <div className="flex flex-col gap-3 rounded-xl border p-3">
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={sourceMajor || "ALL"}
              onValueChange={(value) =>
                pushParams({ source_major: value === "ALL" ? "" : value })
              }
            >
              <SelectTrigger className="h-11 w-full" aria-label="출처">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">출처 전체</SelectItem>
                {SOURCE_MAJOR_OPTIONS.map((major) => (
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
