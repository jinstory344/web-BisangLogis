"use client"

import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { PAID_TEXT_CLASS } from "@/components/dispatches/payment-badge"
import { chipVariants } from "@/components/form/choice-chips"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants/payment-method"
import { SOURCE_MAJOR_OPTIONS } from "@/lib/constants/source"
import {
  formatMonthDay,
  formatYearMonth,
  getCurrentMonthRangeInSeoul,
  isFullMonthRange,
  shiftMonthRange,
} from "@/lib/date"
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
  const currentMonth = getCurrentMonthRangeInSeoul()
  const isCurrentMonth = from === currentMonth.from && to === currentMonth.to
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

  function monthHref(months: number) {
    return hrefWith({ ...shiftMonthRange(from, months) })
  }

  const label = isMonth
    ? formatYearMonth(from)
    : `${formatMonthDay(from)} ~ ${formatMonthDay(to)}`

  const unpaid = summary.unpaid.supplyAmount

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Link
          href={monthHref(-1)}
          aria-label="이전 달"
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="flex flex-col items-center">
          <span className="text-lg font-semibold">{label}</span>
          {isCurrentMonth ? null : (
            <Link
              href={hrefWith({ ...currentMonth })}
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              이번 달로
            </Link>
          )}
        </div>
        <Link
          href={monthHref(1)}
          aria-label="다음 달"
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <ChevronRight className="size-5" />
        </Link>
      </div>

      <div className="rounded-xl border p-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-xs text-muted-foreground">매출</p>
            <p className="text-base font-semibold tabular-nums">
              {formatKRW(summary.all.supplyAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">입금</p>
            <p
              className={cn(
                "text-base font-semibold tabular-nums",
                summary.paid.supplyAmount > 0 && PAID_TEXT_CLASS
              )}
            >
              {formatKRW(summary.paid.supplyAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">미입금</p>
            <p
              className={cn(
                "text-base font-semibold tabular-nums",
                unpaid > 0 && "text-destructive"
              )}
            >
              {formatKRW(unpaid)}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          공급가액 기준 · 세액 포함 합계금액 {formatKRW(summary.all.totalAmount)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="no-scrollbar -mx-4 flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 py-0.5 [contain:inline-size]">
          {STATUS_CHIPS.map((chip) => (
            <Link
              key={chip.key}
              href={hrefWith({ payment_status: chip.value })}
              aria-current={paymentStatus === chip.value ? "true" : undefined}
              className={chipVariants({ selected: paymentStatus === chip.value })}
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

/** 기간 직접 지정: 입력을 마치고 포커스가 벗어나면 적용한다 (데스크톱 필터와 같은 방식). */
function DateRangeInputs({
  from,
  to,
  onApply,
}: {
  from: string
  to: string
  onApply: (range: { from: string; to: string }) => void
}) {
  const [dateFrom, setDateFrom] = useState(from)
  const [dateTo, setDateTo] = useState(to)

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        aria-label="시작일"
        value={dateFrom}
        onChange={(e) => setDateFrom(e.target.value)}
        onBlur={() => onApply({ from: dateFrom, to: dateTo })}
        className="h-11 min-w-0 flex-1"
      />
      <span className="text-muted-foreground">~</span>
      <Input
        type="date"
        aria-label="종료일"
        value={dateTo}
        onChange={(e) => setDateTo(e.target.value)}
        onBlur={() => onApply({ from: dateFrom, to: dateTo })}
        className="h-11 min-w-0 flex-1"
      />
    </div>
  )
}
