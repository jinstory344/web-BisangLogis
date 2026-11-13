/** 검색어 최대 길이 */
export const SEARCH_MAX_LENGTH = 30

/**
 * 검색창에 넣은 글자를 DB 검색에 안전한 형태로 다듬는다.
 * PostgREST의 or 필터 문법을 깨는 글자(쉼표·괄호·따옴표·역슬래시)와 와일드카드(% * _)는 빼고,
 * 공백을 하나로 줄이고 앞뒤 공백을 지운 뒤 최대 길이로 자른다.
 */
export function normalizeSearchQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return ""
  return value
    .replace(/[,()"'\\%*_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SEARCH_MAX_LENGTH)
    .trim()
}

/** 여러 칸 중 하나라도 검색어를 포함하면 맞는 or 필터: `a.ilike.%q%,b.ilike.%q%` */
export function buildIlikeOrFilter(columns: readonly string[], query: string): string {
  return columns.map((column) => `${column}.ilike.%${query}%`).join(",")
}
