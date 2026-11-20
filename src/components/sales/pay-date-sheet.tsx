"use client"

import { useState } from "react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { addDaysToDate, getTodayInSeoul } from "@/lib/date"
import { monthCells, shortMonthDay } from "@/lib/sales-pay-text"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

const rowClass =
  "flex h-14 w-full items-center justify-center border-t border-foreground/10 bg-popover text-[17px] text-[#0a84ff] active:bg-muted disabled:opacity-40 md:h-11 md:text-base"

/**
 * 입금 처리 창(사용자 고른 시안 B, 아이폰식 메뉴):
 * [오늘 입금] [어제 입금] [입금 날짜 선택 → 이번 달 달력] / [취소]. 누르는 즉시 그 날짜로 입금 처리한다.
 */
export function PayDateSheet({
  open,
  onOpenChange,
  title,
  caption,
  onPick,
  disabled = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 예: "330,000원 입금 처리할까요?" */
  title: string
  /** 예: "피셔 → 칠곡경북대병원 · 우영로지스" */
  caption?: string
  /** 고른 입금일("YYYY-MM-DD") */
  onPick: (date: string) => void
  disabled?: boolean
}) {
  const today = getTodayInSeoul()
  const yesterday = addDaysToDate(today, -1)
  const [isPicking, setIsPicking] = useState(false)
  const [month, setMonth] = useState(today.slice(0, 7))

  function close(next: boolean) {
    if (!next) {
      setIsPicking(false)
      setMonth(today.slice(0, 7))
    }
    onOpenChange(next)
  }

  function pick(date: string) {
    onPick(date)
    close(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        <div className="overflow-hidden rounded-[14px] md:rounded-none">
          <AlertDialogHeader className="rounded-none">
            <AlertDialogTitle>{isPicking ? "입금 날짜 선택" : title}</AlertDialogTitle>
            <AlertDialogDescription>
              {isPicking ? [title.replace(/ 입금 처리할까요\?$/, ""), caption].filter(Boolean).join(" · ") : caption}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {isPicking ? (
            <div className="bg-popover px-2 pb-3">
              <div className="flex items-center justify-between px-2 py-2">
                <button
                  type="button"
                  aria-label="이전 달"
                  onClick={() => setMonth(shiftMonth(month, -1))}
                  className="flex size-9 items-center justify-center text-xl text-[#0a84ff]"
                >
                  ‹
                </button>
                <span className="text-[15px] font-semibold">
                  {Number(month.slice(0, 4))}년 {Number(month.slice(5, 7))}월
                </span>
                <button
                  type="button"
                  aria-label="다음 달"
                  disabled={month >= today.slice(0, 7)}
                  onClick={() => setMonth(shiftMonth(month, 1))}
                  className="flex size-9 items-center justify-center text-xl text-[#0a84ff] disabled:opacity-30"
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="py-1">
                    {w}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-1 text-center">
                {monthCells(month).map((date, i) =>
                  date ? (
                    <button
                      key={date}
                      type="button"
                      // 아직 안 온 날은 입금일로 고를 수 없다
                      disabled={disabled || date > today}
                      onClick={() => pick(date)}
                      className={cn(
                        "mx-auto flex size-10 items-center justify-center rounded-full text-[15px] tabular-nums active:bg-[#0a84ff] active:text-white disabled:opacity-30",
                        date === today && "font-bold text-[#0a84ff]"
                      )}
                    >
                      {Number(date.slice(8, 10))}
                    </button>
                  ) : (
                    <span key={`blank-${i}`} />
                  )
                )}
              </div>
            </div>
          ) : (
            <>
              <button type="button" disabled={disabled} onClick={() => pick(today)} className={rowClass}>
                오늘({shortMonthDay(today)}) 입금
              </button>
              <button type="button" disabled={disabled} onClick={() => pick(yesterday)} className={rowClass}>
                어제({shortMonthDay(yesterday)}) 입금
              </button>
              <button type="button" disabled={disabled} onClick={() => setIsPicking(true)} className={rowClass}>
                입금 날짜 선택
              </button>
            </>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
