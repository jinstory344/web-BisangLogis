"use client"

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getTodayInSeoul } from "@/lib/date"
import { cn } from "@/lib/utils"

const YEARS_PER_PAGE = 12

/** 해 고르기 칸의 첫 해: 12개씩 끊어서, 보고 있는 해가 들어가는 묶음 */
export function yearPageStart(year: number): number {
  return year - ((((year - 2020) % YEARS_PER_PAGE) + YEARS_PER_PAGE) % YEARS_PER_PAGE)
}

interface PeriodPickerProps {
  /** month: 1~12월 고르기(위에서 해 넘기기) / year: 해 고르기 */
  mode: "month" | "year"
  /** 지금 보고 있는 날짜 (yyyy-MM-dd) */
  value: string
  /** 가운데에 보일 글자 (예: "2026년 11월") */
  label: string
  /** 고른 달·해의 첫날(yyyy-MM-01 / yyyy-01-01)로 갈 주소 */
  hrefFor: (date: string) => string
}

/**
 * 달 이동 가운데의 "2026년 11월"을 누르면 1~12월을 바로 고르는 창이 뜬다.
 * 화살표·스와이프로 여러 달을 넘기지 않아도 된다.
 */
export function PeriodPicker({ mode, value, label, hrefFor }: PeriodPickerProps) {
  const [open, setOpen] = useState(false)
  const selectedYear = Number(value.slice(0, 4))
  const selectedMonth = Number(value.slice(5, 7))
  const today = getTodayInSeoul()
  const thisYear = Number(today.slice(0, 4))
  const thisMonth = Number(today.slice(5, 7))

  // 창 안에서 넘겨 보는 해(달 고르기) 또는 해 묶음의 첫 해(해 고르기)
  const [pageYear, setPageYear] = useState(
    mode === "month" ? selectedYear : yearPageStart(selectedYear)
  )

  function handleOpenChange(next: boolean) {
    // 열 때마다 보고 있는 해에서 시작한다.
    if (next) setPageYear(mode === "month" ? selectedYear : yearPageStart(selectedYear))
    setOpen(next)
  }

  const step = mode === "month" ? 1 : YEARS_PER_PAGE
  const pageLabel =
    mode === "month" ? `${pageYear}년` : `${pageYear}년 ~ ${pageYear + YEARS_PER_PAGE - 1}년`

  const cells =
    mode === "month"
      ? Array.from({ length: 12 }, (_, i) => {
          const month = i + 1
          return {
            key: month,
            text: `${month}월`,
            href: hrefFor(`${pageYear}-${String(month).padStart(2, "0")}-01`),
            selected: pageYear === selectedYear && month === selectedMonth,
            current: pageYear === thisYear && month === thisMonth,
          }
        })
      : Array.from({ length: YEARS_PER_PAGE }, (_, i) => {
          const year = pageYear + i
          return {
            key: year,
            text: `${year}`,
            href: hrefFor(`${year}-01-01`),
            selected: year === selectedYear,
            current: year === thisYear,
          }
        })

  const currentHref =
    mode === "month" ? hrefFor(`${today.slice(0, 7)}-01`) : hrefFor(`${thisYear}-01-01`)

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className="flex min-h-10 items-center gap-1 rounded-md px-2 text-base font-semibold hover:bg-muted"
        aria-label={mode === "month" ? "달 고르기" : "해 고르기"}
      >
        {label}
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] gap-0 p-0" align="center">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {mode === "month" ? "달 고르기" : "해 고르기"}
          </span>
          <Link
            href={currentHref}
            onClick={() => setOpen(false)}
            className="rounded-md px-2 py-1 text-sm font-medium text-blue-600 hover:bg-muted dark:text-blue-400"
          >
            {mode === "month" ? "이번 달" : "올해"}
          </Link>
        </div>
        <div className="flex items-center justify-between border-b px-1 py-1">
          <button
            type="button"
            onClick={() => setPageYear((y) => y - step)}
            aria-label={mode === "month" ? "이전 해" : "이전 해 묶음"}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="text-sm font-semibold">{pageLabel}</span>
          <button
            type="button"
            onClick={() => setPageYear((y) => y + step)}
            aria-label={mode === "month" ? "다음 해" : "다음 해 묶음"}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1 p-2">
          {cells.map((cell) => (
            <Link
              key={cell.key}
              href={cell.href}
              onClick={() => setOpen(false)}
              aria-current={cell.selected ? "true" : undefined}
              className={cn(
                "flex h-11 items-center justify-center rounded-md text-sm tabular-nums hover:bg-muted",
                cell.selected && "bg-muted font-semibold text-red-600 dark:text-red-400",
                !cell.selected && cell.current && "font-semibold text-blue-600 dark:text-blue-400"
              )}
            >
              {cell.text}
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
