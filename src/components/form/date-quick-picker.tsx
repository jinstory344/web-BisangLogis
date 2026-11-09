"use client"

import { CalendarDays } from "lucide-react"

import {
  addDaysToDate,
  formatDateChipLabel,
  formatMonthDay,
  getTodayInSeoul,
} from "@/lib/date"
import { cn } from "@/lib/utils"

import { chipVariants } from "./choice-chips"

interface DateQuickPickerProps {
  /** yyyy-MM-dd */
  value: string
  onChange: (value: string) => void
  id?: string
  disabled?: boolean
  "aria-label"?: string
  "aria-describedby"?: string
}

/**
 * 날짜 빠른 선택: [오늘(M/D)] [어제] [날짜 선택] 칩.
 * 오늘/어제는 서울 기준(getTodayInSeoul)으로 계산하고, 그 밖의 날짜는 세 번째 칩에 겹쳐 둔
 * 네이티브 date input으로 고른다 (고른 뒤에는 세 번째 칩에 그 날짜를 표시).
 *
 * 필수 날짜 필드 전용이라, 네이티브 피커의 "지우기"로 빈 값이 와도 무시하고 이전 날짜를 유지한다.
 */
export function DateQuickPicker({
  value,
  onChange,
  id,
  disabled,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: DateQuickPickerProps) {
  const today = getTodayInSeoul()
  const yesterday = addDaysToDate(today, -1)
  const isToday = value === today
  const isYesterday = value === yesterday
  const isOtherDate = value !== "" && !isToday && !isYesterday

  return (
    <div
      id={id}
      role="group"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className="flex flex-wrap gap-2"
    >
      <button
        type="button"
        aria-pressed={isToday}
        disabled={disabled}
        className={chipVariants({ selected: isToday })}
        onClick={() => onChange(today)}
      >
        오늘({formatMonthDay(today)})
      </button>
      <button
        type="button"
        aria-pressed={isYesterday}
        disabled={disabled}
        className={chipVariants({ selected: isYesterday })}
        onClick={() => onChange(yesterday)}
      >
        어제
      </button>
      <span
        className={cn(
          chipVariants({ selected: isOtherDate }),
          "relative focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <CalendarDays aria-hidden />
        <span aria-hidden>
          {isOtherDate ? formatDateChipLabel(value, today) : "날짜 선택"}
        </span>
        {/* 칩 전체를 덮는 투명 네이티브 입력: 모바일은 탭하면 OS 날짜 피커가 열리고,
            데스크톱은 클릭 시 showPicker()로 연다. text-base(16px)는 iOS 확대 방지용. */}
        <input
          type="date"
          value={value}
          disabled={disabled}
          aria-label={
            isOtherDate
              ? `날짜 선택, 현재 ${formatDateChipLabel(value, today)}`
              : "날짜 선택"
          }
          className="absolute inset-0 size-full cursor-pointer appearance-none rounded-full text-base opacity-0"
          onClick={(event) => {
            try {
              event.currentTarget.showPicker()
            } catch {
              // showPicker 미지원/이미 열림 — 브라우저 기본 동작에 맡긴다.
            }
          }}
          onChange={(event) => {
            if (event.target.value) onChange(event.target.value)
          }}
        />
      </span>
    </div>
  )
}
