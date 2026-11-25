/**
 * 차계부 공통 상수·작은 도우미.
 * 업무용 트럭의 차 비용은 지출(expenses)이 원본이고, 차계부는 지출의 `차량` 대분류 중
 * 소분류 `정비`·`주유비`·`요소수`만 가져와 보여 준다(하이패스·주차·용차는 제외).
 */

/** 지출 대분류 */
export const CAR_EXPENSE_MAJOR = "차량"
/** 지출 소분류 '정비' (정비 항목 줄이 붙는 분류) */
export const CAR_SERVICE_MINOR = "정비"

/** 차계부가 가져오는 지출 소분류 → 차계부에서 보이는 종류 이름 */
export const CAR_EXPENSE_MINOR_TO_KIND: Readonly<Record<string, string>> = {
  정비: "정비",
  주유비: "주유",
  요소수: "요소수",
}

export const CAR_EXPENSE_MINORS = Object.keys(CAR_EXPENSE_MINOR_TO_KIND)

/** 차계부 종류 '정비' (트럭·승용차 공통) */
export const SERVICE_KIND = "정비"
/** 차계부 종류 '주유' */
export const FUEL_KIND = "주유"
/** 업무용 차(지출 기반)의 종류 순서 */
export const BUSINESS_KINDS = ["정비", "주유", "요소수"] as const
/** 승용차 기록 종류 중 지울 수 없는 것 (화면에서 막는다) */
export const PROTECTED_LOG_KINDS = ["주유", "정비"] as const

/** 리터 칸이 나오는 종류 */
export const LITER_KINDS = ["주유", "요소수"] as const

/** 지출 분류가 차계부 대상(차량 › 정비·주유비·요소수)인지 — km 칸이 나온다 */
export function isCarTrackedCategory(major: string, minor: string): boolean {
  return major === CAR_EXPENSE_MAJOR && minor in CAR_EXPENSE_MINOR_TO_KIND
}

/** 지출 분류가 차량 › 정비인지 — 정비 항목 칸이 나온다 */
export function isCarServiceCategory(major: string, minor: string): boolean {
  return major === CAR_EXPENSE_MAJOR && minor === CAR_SERVICE_MINOR
}

export function isLiterKind(kind: string): boolean {
  return (LITER_KINDS as readonly string[]).includes(kind)
}

export function isProtectedLogKind(kind: string): boolean {
  return (PROTECTED_LOG_KINDS as readonly string[]).includes(kind)
}

/** 종류별 막대·범례 색 (어두운 화면에서 눈이 편한 낮은 채도). 순서대로 돌아가며 쓴다. */
export const KIND_COLORS = [
  "#c65a55", // 빨강 (정비)
  "#5b8fd9", // 파랑 (주유)
  "#6aad83", // 초록 (요소수·세차)
  "#d6a84a", // 노랑
  "#9b7fd1", // 보라
  "#4fb3b3", // 청록
  "#a1a1aa", // 회색
] as const

export function kindColor(index: number): string {
  return KIND_COLORS[index % KIND_COLORS.length]
}

/** km 최댓값 (DB check와 같음) */
export const MAX_KM = 9_999_999

/**
 * km 입력 글자 → 숫자. 빈칸은 null, 잘못된 값은 NaN. 쉼표·"km"는 무시한다.
 * (zod coerce를 쓰지 않으려고 폼에서는 글자로 두고 서버에서 이 함수로 바꾼다)
 */
export function parseKm(raw: string): number | null {
  const text = raw.trim().replace(/,/g, "").replace(/\s*km$/i, "")
  if (text === "") return null
  if (!/^\d{1,7}$/.test(text)) return Number.NaN
  const value = Number(text)
  return value <= MAX_KM ? value : Number.NaN
}

/** 615848 → "615,848" */
export function formatKmNumber(km: number): string {
  return km.toLocaleString("ko-KR")
}

/** 615848 → "615,848km" */
export function formatKm(km: number): string {
  return `${formatKmNumber(km)}km`
}

/** 리터 단가(원/L, 반올림). 리터가 없거나 0이면 null */
export function unitPrice(amount: number, liters: number | null): number | null {
  if (liters === null || !(liters > 0)) return null
  return Math.round(amount / liters)
}

/** 3,520,000 → "352만 원" (1만 원 미만은 "5,000원") */
export function formatManwon(amount: number): string {
  if (Math.abs(amount) < 10_000) return `${amount.toLocaleString("ko-KR")}원`
  return `${Math.round(amount / 10_000).toLocaleString("ko-KR")}만 원`
}

/**
 * 날짜 줄 표시: 올해면 "11/25 (화)", 다른 해면 "25/12/03 (수)".
 */
export function formatEntryDate(date: string, today: string): string {
  const [year, month, day] = date.split("-").map(Number)
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ]
  const md = `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`
  return date.slice(0, 4) === today.slice(0, 4)
    ? `${md} (${weekday})`
    : `${date.slice(2, 4)}/${md} (${weekday})`
}
