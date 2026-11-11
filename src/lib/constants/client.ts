import type { ClientCategory } from "@/lib/supabase/database.types"

export const CLIENT_CATEGORY_LABELS: Record<ClientCategory, string> = {
  MINE: "내 거래처",
  OTHER: "타 거래처",
}

export const CLIENT_CATEGORY_OPTIONS = (
  Object.entries(CLIENT_CATEGORY_LABELS) as [ClientCategory, string][]
).map(([value, label]) => ({ value, label }))

/** 새 거래처의 처음 구분. 거래처 관리 화면과 배차 화면의 즉석 등록이 모두 이 값을 쓴다. */
export const DEFAULT_CLIENT_CATEGORY: ClientCategory = "MINE"

/** 거래처 목록의 구분 필터 ("ALL"은 거르지 않음). */
export type ClientCategoryFilter = ClientCategory | "ALL"

/**
 * 알 수 없거나 비어 있는 값(마이그레이션 전 행, 잘못된 값)은 기본 구분으로 본다.
 * "OTHER"만 타 거래처이고 나머지는 모두 내 거래처다.
 */
export function normalizeClientCategory(value: unknown): ClientCategory {
  return value === "OTHER" ? "OTHER" : DEFAULT_CLIENT_CATEGORY
}

/** URL ?category= 값을 필터로 바꾼다. MINE/OTHER 외에는 모두 전체로 본다. */
export function parseClientCategoryFilter(
  value: string | string[] | undefined
): ClientCategoryFilter {
  const single = Array.isArray(value) ? value[0] : value
  return single === "MINE" || single === "OTHER" ? single : "ALL"
}
