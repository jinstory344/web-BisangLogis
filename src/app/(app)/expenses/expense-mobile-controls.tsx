"use client"

import { SlidersHorizontal } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { DateRangeInputs } from "@/components/list/date-range-inputs"
import { EXPENSE_TEXT_CLASS } from "@/components/ledger/colors"
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
import {
  getMinorsOf,
  type ExpenseCategoryTree,
} from "@/lib/constants/expense-categories"
import { isAllPeriod, isFullMonthRange } from "@/lib/date"
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
 * 모바일 지출 목록 상단: 지출 합계 · "전체 N건 + 분류 펼침 목록" · 접히는 자세한 필터(소분류·기간).
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

  // 전체 기간(HOME 미입금 줄에서 들어옴)은 직접 지정한 기간 필터로 세지 않는다
  const isMonth = isFullMonthRange({ from, to }) || isAllPeriod({ from, to })
  // 기간 직접 지정이나 소분류가 걸려 있으면 필터 버튼에 표시한다.
  const activeFilterCount = (isMonth ? 0 : 1) + (categoryMinor ? 1 : 0)
  const [isFilterOpen, setIsFilterOpen] = useState(activeFilterCount > 0)

  const minorOptions = categoryMajor ? getMinorsOf(categories, categoryMajor) : []

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
      <StickyHead topPx={LIST_PAGE_HEAD_PX} className={LIST_SUB_STICKY_CLASS}>
        <TotalsRow
          items={[
            {
              label: "지출 합계",
              value: formatKRW(summary.total),
              // 강조 금액은 다른 화면의 수익처럼 굵게 (크기는 앱 공통 14px · 18px)
              className: `${EXPENSE_TEXT_CLASS} font-bold`,
            },
          ]}
          size="lg"
        />
        {/* 대분류 칩 줄 대신 "전체 35건 + [분류 ▾]" (칩 줄을 밀면 화면 전체가 밀리던 문제) */}
        <ListPickerRow
          placeholder="분류"
          value={categoryMajor}
          options={chips.map((chip) => ({
            ...chip,
            href: hrefWith({ category_major: chip.value, category_minor: "" }),
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
            from={isAllPeriod({ from, to }) ? "" : from}
            to={isAllPeriod({ from, to }) ? "" : to}
            onApply={(range) => pushParams(range)}
          />
        </div>
      ) : null}
    </div>
  )
}
