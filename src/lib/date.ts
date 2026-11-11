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

/** yyyy-MM-dd -> "M/D" 축약 표기 (예: 2026-08-06 -> 8/6) */
export function formatMonthDay(dateStr: string): string {
  const [, month, day] = dateStr.split("-").map(Number)
  return `${month}/${day}`
}

/**
 * yyyy-MM-dd에 일수를 더한 yyyy-MM-dd를 돌려준다 (음수면 과거).
 * 달력 날짜끼리의 연산이라 타임존과 무관하도록 UTC 기준으로 계산한다.
 * 예: addDaysToDate("2026-03-01", -1) -> "2026-02-28"
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10)
}

/**
 * 날짜 선택 칩 라벨: 오늘과 같은 해면 "M/D(요일)", 다른 해면 "yy/M/D(요일)".
 * 예: ("2026-11-05", "2026-11-08") -> "11/5(목)", ("2025-12-31", "2026-01-02") -> "25/12/31(수)"
 */
export function formatDateChipLabel(dateStr: string, today: string): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  const weekday = WEEKDAY_LABELS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  const monthDay = `${month}/${day}(${weekday})`
  return dateStr.slice(0, 4) === today.slice(0, 4)
    ? monthDay
    : `${dateStr.slice(2, 4)}/${monthDay}`
}

/**
 * 월 내 주차: 1~7일=1주차, 8~14일=2주차 … 29~31일=5주차 (달력상 요일 정렬이
 * 아닌 날짜 블록 기준이라 매달 최대 5주차로 고정된다).
 */
export function getWeekOfMonth(dateStr: string): number {
  const day = Number(dateStr.split("-")[2])
  return Math.ceil(day / 7)
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

/** yyyy-MM-dd가 속한 달의 1일~말일 범위 (달력 날짜 연산이라 타임존과 무관) */
export function getMonthRange(dateStr: string): DateRange {
  const [year, month] = dateStr.split("-").map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const prefix = `${year}-${String(month).padStart(2, "0")}`
  return { from: `${prefix}-01`, to: `${prefix}-${String(lastDay).padStart(2, "0")}` }
}

/**
 * yyyy-MM-dd가 속한 달에서 months개월 이동한 달의 1일~말일 범위 (음수면 과거).
 * 예: shiftMonthRange("2026-01-15", -1) -> { from: "2025-12-01", to: "2025-12-31" }
 */
export function shiftMonthRange(dateStr: string, months: number): DateRange {
  const [year, month] = dateStr.split("-").map(Number)
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1))
  return getMonthRange(shifted.toISOString().slice(0, 10))
}

/** 기간이 정확히 한 달 전체(1일~말일)인지 */
export function isFullMonthRange(range: DateRange): boolean {
  const month = getMonthRange(range.from)
  return range.from === month.from && range.to === month.to
}

/** yyyy-MM-dd -> "2026년 11월" */
export function formatYearMonth(dateStr: string): string {
  const [year, month] = dateStr.split("-").map(Number)
  return `${year}년 ${month}월`
}

/** yyyy-MM-dd -> 요일 한 글자 ("월"~"일") */
export function getWeekdayLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  return WEEKDAY_LABELS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
}
