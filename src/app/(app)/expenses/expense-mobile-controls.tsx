"use client"

import { SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { chipVariants } from "@/components/form/choice-chips"
import { DateRangeInputs } from "@/components/list/date-range-inputs"
import { EXPENSE_TEXT_CLASS } from "@/components/ledger/colors"
import { LIST_CHIP_CLASS, LIST_SUB_STICKY_CLASS } from "@/components/list/list-page-head"
import { TotalsRow } from "@/components/list/totals-row"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getMinorsOf,
  type ExpenseCategoryTree,
} from "@/lib/constants/expense-categories"
import { isFullMonthRange } from "@/lib/date"
import type { ExpenseSummary } from "@/lib/expense-list"
import { formatKRW } from "@/lib/money"
import { cn } from "@/lib/utils"

interface ExpenseMobileControlsProps {
  from: string
  to: string
  categoryMajor: string
  categoryMinor: string
  /** 기간 안의 전체 지출 요약 (대분류·소분류 필터와 상관없이 센 것) */
  summary: ExpenseSummary
  /** 분류 목록 (DB) — 소분류 필터 선택지 */
  categories: ExpenseCategoryTree
}

/**
 * 모바일 지출 목록 상단: 달 이동 · 지출 합계(+대분류별 금액) · 대분류 칩 · 접히는 필터.
 * 칩은 대분류로 목록을 거르고, 필터 안에는 소분류와 기간 직접 지정이 있다.
 * 데스크톱은 기존 ExpenseFilters를 그대로 쓴다.
 */
export function ExpenseMobileControls({
  from,
  to,
  categoryMajor,
  categoryMinor,
  summary,
  categories,
}: ExpenseMobileControlsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isMonth = isFullMonthRange({ from, to })
  // 기간 직접 지정이나 소분류가 걸려 있으면 필터 버튼에 표시한다.
  const activeFilterCount = (isMonth ? 0 : 1) + (categoryMinor ? 1 : 0)
  const [isFilterOpen, setIsFilterOpen] = useState(activeFilterCount > 0)

  const minorOptions = categoryMajor ? getMinorsOf(categories, categoryMajor) : []
  const spent = summary.byMajor.filter((major) => major.count > 0)

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

  const chips = [
    { value: "", label: "전체", count: summary.count },
    ...summary.byMajor.map((major) => ({
      value: major.major,
      label: major.major,
      count: major.count,
    })),
  ]

  return (
    // contents: 자식들이 목록 영역의 직접 자식처럼 놓여서 아래 고정 영역이 목록 끝까지 붙어 있을 수 있다
    <div className="contents">
      {/* 위에 고정: 합계 줄 (달 이동은 위 머리에 있다) */}
      <div className={LIST_SUB_STICKY_CLASS}>
        <TotalsRow
          items={[
            {
              label: "지출 합계",
              value: formatKRW(summary.total),
              className: EXPENSE_TEXT_CLASS,
            },
          ]}
          size="lg"
        />
      </div>

      {spent.length > 0 ? (
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
          {spent.map((major) => (
            <span key={major.major}>
              {major.major} {formatKRW(major.total)}
            </span>
          ))}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <div className="no-scrollbar -ml-4 flex min-w-0 flex-1 gap-2 overflow-x-auto py-0.5 pl-4 [contain:inline-size]">
          {chips.map((chip) => (
            <Link
              key={chip.value || "all"}
              href={hrefWith({ category_major: chip.value, category_minor: "" })}
              aria-current={categoryMajor === chip.value ? "true" : undefined}
              className={cn(chipVariants({ selected: categoryMajor === chip.value }), LIST_CHIP_CLASS)}
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
          {categoryMajor ? (
            <Select
              value={categoryMinor || "ALL"}
              onValueChange={(value) =>
                pushParams({ category_minor: value === "ALL" ? "" : value })
              }
            >
              <SelectTrigger className="h-11 w-full" aria-label="소분류">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{categoryMajor} 소분류 전체</SelectItem>
                {minorOptions.map((minor) => (
                  <SelectItem key={minor} value={minor}>
                    {minor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-xs text-muted-foreground">
              소분류로 거르려면 위에서 대분류를 먼저 고르세요.
            </p>
          )}

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
