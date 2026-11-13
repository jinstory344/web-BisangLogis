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

/** 거래처 이름으로 찾은 id가 있으면 그 거래처에 연결된 건도 맞게 or 필터 끝에 붙인다. */
export function appendClientIdFilter(filter: string, clientIds: readonly string[]): string {
  return clientIds.length > 0 ? `${filter},client_id.in.(${clientIds.join(",")})` : filter
}

export type SearchTab = "ledger" | "dispatch"

/**
 * 검색 결과 탭: 주소에 고른 탭이 있으면 그것, 없으면 매출·지출에 결과가 있으면 매출·지출,
 * 매출·지출은 없고 배차만 있으면 배차를 먼저 보여 준다.
 */
export function pickSearchTab(
  raw: string | string[] | undefined,
  ledgerCount: number,
  dispatchCount: number
): SearchTab {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === "ledger" || value === "dispatch") return value
  return ledgerCount === 0 && dispatchCount > 0 ? "dispatch" : "ledger"
}

/** 찾은 배차들의 운임·수수료 합계 (운임이 비어 있는 건은 0으로 친다) */
export function sumDispatchTotals(
  rows: readonly { freight_amount: number | null; fee_amount: number }[]
): { freight: number; fee: number } {
  return rows.reduce(
    (sum, row) => ({
      freight: sum.freight + (row.freight_amount ?? 0),
      fee: sum.fee + row.fee_amount,
    }),
    { freight: 0, fee: 0 }
  )
}
