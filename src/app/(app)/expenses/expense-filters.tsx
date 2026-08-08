"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  EXPENSE_CATEGORY_MAJORS,
  getMinorCategories,
} from "@/lib/constants/expense-categories"
import {
  getCurrentMonthRangeInSeoul,
  getPreviousMonthRangeInSeoul,
} from "@/lib/date"

interface ExpenseFiltersProps {
  from: string
  to: string
  categoryMajor: string
  categoryMinor: string
}

export function ExpenseFilters({
  from,
  to,
  categoryMajor,
  categoryMinor,
}: ExpenseFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [dateFrom, setDateFrom] = useState(from)
  const [dateTo, setDateTo] = useState(to)

  const minorOptions = categoryMajor
    ? getMinorCategories(categoryMajor)
    : []

  function pushParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(next).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`)
  }

  function applyDateRange(range: { from: string; to: string }) {
    setDateFrom(range.from)
    setDateTo(range.to)
    pushParams({ from: range.from, to: range.to })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => applyDateRange(getCurrentMonthRangeInSeoul())}
        >
          이번 달
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => applyDateRange(getPreviousMonthRangeInSeoul())}
        >
          지난 달
        </Button>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          onBlur={() => pushParams({ from: dateFrom, to: dateTo })}
          className="w-auto"
        />
        <span className="text-muted-foreground">~</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          onBlur={() => pushParams({ from: dateFrom, to: dateTo })}
          className="w-auto"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={categoryMajor || "ALL"}
          onValueChange={(value) =>
            pushParams({
              category_major: value === "ALL" ? "" : value,
              category_minor: "",
            })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">대분류 전체</SelectItem>
            {EXPENSE_CATEGORY_MAJORS.map((major) => (
              <SelectItem key={major} value={major}>
                {major}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={categoryMinor || "ALL"}
          onValueChange={(value) =>
            pushParams({ category_minor: value === "ALL" ? "" : value })
          }
          disabled={!categoryMajor}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">소분류 전체</SelectItem>
            {minorOptions.map((minor) => (
              <SelectItem key={minor} value={minor}>
                {minor}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
