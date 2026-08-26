/**
 * 3.1 필수 제약: 모든 날짜는 화면 표시 시 Asia/Seoul 기준으로 변환한다.
 * 브라우저/서버의 로컬 타임존에 의존하지 않도록 Intl API로 명시적으로 계산한다.
 */

const SEOUL_TIME_ZONE = "Asia/Seoul"

/** 서울 기준 오늘 날짜를 yyyy-MM-dd 문자열로 반환한다. */
export function getTodayInSeoul(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SEOUL_TIME_ZONE }).format(
    new Date()
  )
}

export interface DateRange {
  from: string
  to: string
}

/** 7.3 기간 빠른 선택: 이번 달 (서울 기준) */
export function getCurrentMonthRangeInSeoul(): DateRange {
  const today = getTodayInSeoul()
  const [year, month] = today.split("-").map(Number)
  const from = `${year}-${String(month).padStart(2, "0")}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  return { from, to }
}

/** yyyy-MM-dd -> yy-MM-dd 축약 표기 (예: 2026-08-06 -> 26-08-06) */
export function formatShortDate(dateStr: string): string {
  return dateStr.slice(2)
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"]

/** yyyy-MM-dd -> yy-MM-dd 요일 표기 (예: 2026-08-26 -> 26-08-26 수요일) */
export function formatDateWithWeekday(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  const weekday = WEEKDAY_LABELS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${formatShortDate(dateStr)} ${weekday}요일`
}

/** 7.3 기간 빠른 선택: 지난 달 (서울 기준) */
export function getPreviousMonthRangeInSeoul(): DateRange {
  const today = getTodayInSeoul()
  const [year, month] = today.split("-").map(Number)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const from = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`
  const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate()
  const to = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  return { from, to }
}
