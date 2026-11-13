"use client"

import { addDaysToDate, getTodayInSeoul, getWeekdayLabel } from "@/lib/date"

import { DateQuickPicker } from "./date-quick-picker"

/** "11. 13. (금)" — 올해가 아니면 "2025. 11. 13. (목)" */
function formatRowDate(date: string, today: string): string {
  const [year, month, day] = date.split("-")
  const md = `${Number(month)}. ${Number(day)}. (${getWeekdayLabel(date)})`
  return year === today.slice(0, 4) ? md : `${year}. ${md}`
}

/**
 * 날짜 한 줄 (가계부 앱 방식).
 * 모바일: "11. 13. (금)"을 누르면 폰 날짜 선택이 열리고, 오른쪽 작은 "어제"/"오늘"로 바로 바꾼다.
 * 데스크톱(md 이상): 기존 [오늘][어제][날짜 선택] 칩.
 * 필수 날짜라 날짜 선택의 "지우기"로 빈 값이 와도 무시한다.
 */
export function DateRow({
  value,
  onChange,
  label,
}: {
  /** yyyy-MM-dd */
  value: string
  onChange: (value: string) => void
  /** 접근성 이름 (예: "매출일자") */
  label: string
}) {
  const today = getTodayInSeoul()
  const yesterday = addDaysToDate(today, -1)
  const quick = value === today ? { label: "어제", date: yesterday } : { label: "오늘", date: today }

  return (
    <>
      <div className="flex min-h-11 items-center justify-between gap-2 border-b md:hidden">
        <span className="relative flex min-h-11 flex-1 items-center text-base">
          {value ? formatRowDate(value, today) : "날짜 선택"}
          {/* 글자 위를 덮는 투명 날짜 입력: 누르면 폰 날짜 선택이 열린다. 16px는 iOS 확대 방지. */}
          <input
            type="date"
            value={value}
            aria-label={`${label} 선택`}
            className="absolute inset-0 size-full cursor-pointer appearance-none text-base opacity-0"
            onClick={(event) => {
              try {
                event.currentTarget.showPicker()
              } catch {
                // showPicker 미지원 — 브라우저 기본 동작
              }
            }}
            onChange={(event) => {
              if (event.target.value) onChange(event.target.value)
            }}
          />
        </span>
        <button
          type="button"
          onClick={() => onChange(quick.date)}
          className="-mr-1 shrink-0 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          {quick.label}
        </button>
      </div>

      <div className="hidden md:block">
        <DateQuickPicker value={value} onChange={onChange} aria-label={label} />
      </div>
    </>
  )
}
