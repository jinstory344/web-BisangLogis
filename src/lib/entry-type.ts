import type { QuickEntryKind } from "@/lib/quick-entry"

/** 통합 등록 화면(/new)의 종류: 매출 · 지출 · 배차 */
export type EntryType = "sale" | "expense" | "dispatch"

export const ENTRY_TYPES: readonly { value: EntryType; label: string }[] = [
  { value: "sale", label: "매출" },
  { value: "expense", label: "지출" },
  { value: "dispatch", label: "배차" },
]

/** 마지막으로 고른 종류를 기억하는 브라우저 저장소 키 (＋ 버튼이 그 종류로 바로 연다) */
export const LAST_ENTRY_TYPE_KEY = "bisang:lastEntryType"

export function isEntryType(value: unknown): value is EntryType {
  return ENTRY_TYPES.some((type) => type.value === value)
}

/** `?type=` 값을 검증한다. 알 수 없는 값이면 fallback. */
export function parseEntryType(
  raw: string | string[] | undefined,
  fallback: EntryType
): EntryType {
  const value = Array.isArray(raw) ? raw[0] : raw
  return isEntryType(value) ? value : fallback
}

const KIND_TO_TYPE: Record<QuickEntryKind, EntryType> = {
  sales: "sale",
  expenses: "expense",
  dispatches: "dispatch",
}

/** 이전 건 복사 링크의 종류(sales/expenses/dispatches) → 통합 등록 화면의 종류 */
export function entryTypeOfKind(kind: QuickEntryKind): EntryType {
  return KIND_TO_TYPE[kind]
}

/** 통합 등록 화면 주소 */
export function newEntryHref(type: EntryType, copyId?: string): string {
  const params = new URLSearchParams({ type })
  if (copyId) params.set("copy", copyId)
  return `/new?${params.toString()}`
}
