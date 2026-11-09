/**
 * 모바일 빠른 등록(+ 버튼 시트) · 이전 건 복사 · 최근 구간 칩에서 공통으로 쓰는 순수 함수/상수.
 * 서버 액션("use server" 파일)은 async 함수 외의 값을 export할 수 없으므로 상수·타입은 여기 둔다.
 */
import type {
  DispatchRow,
  ExpenseRow,
  SaleRow,
} from "@/lib/supabase/database.types"

/** 라우트 세그먼트와 동일한 이름을 쓴다 (`/${kind}/new?copy=${id}`). */
export type QuickEntryKind = "sales" | "dispatches" | "expenses"

export const QUICK_ENTRY_LABELS: Record<QuickEntryKind, string> = {
  sales: "매출",
  dispatches: "배차",
  expenses: "지출",
}

/** 최근 구간 칩 최대 개수 */
export const RECENT_ROUTE_LIMIT = 5
/** 최근 구간을 고르기 위해 읽어올 최근 행 수 (중복 조합을 걸러내고도 5개가 남도록 넉넉히) */
export const RECENT_ROUTE_SCAN_SIZE = 50
/** 빠른 등록 시트 "최근 건 복사" 최대 개수 */
export const RECENT_COPY_LIMIT = 5

export interface RecentRoute {
  origin: string
  destination: string
}

/**
 * 최근 순(created_at 내림차순)으로 정렬된 행에서 서로 다른 (상차지 → 하차지) 조합을
 * 앞에서부터 최대 limit개 고른다. 앞뒤 공백은 같은 조합으로 취급하고, 빈 값은 건너뛴다.
 */
export function pickRecentRoutes(
  rows: readonly RecentRoute[],
  limit = RECENT_ROUTE_LIMIT
): RecentRoute[] {
  const seen = new Set<string>()
  const routes: RecentRoute[] = []

  for (const row of rows) {
    if (routes.length >= limit) break

    const origin = row.origin.trim()
    const destination = row.destination.trim()
    if (!origin || !destination) continue

    const key = JSON.stringify([origin, destination])
    if (seen.has(key)) continue

    seen.add(key)
    routes.push({ origin, destination })
  }

  return routes
}

/**
 * 빠른 등록 시트의 "최근 건 복사" 한 줄.
 * 개인정보(오더자·기사 전화번호 등)는 담지 않는다 — 종류·날짜·구간/분류·금액만.
 */
export interface RecentCopyEntry {
  kind: QuickEntryKind
  id: string
  createdAt: string
  /** 매출일자/운송일자/지출일자 (yyyy-MM-dd) */
  date: string
  /** 매출·배차: "상차지 → 하차지", 지출: "대분류·소분류" */
  summary: string
  /**
   * 매출: 공급가액(매출 목록 카드와 같은 숫자), 배차: 운임(미입력이면 null), 지출: 금액
   */
  amount: number | null
}

export function toSaleCopyEntry(
  row: Pick<
    SaleRow,
    "id" | "created_at" | "sale_date" | "origin" | "destination" | "supply_amount"
  >
): RecentCopyEntry {
  return {
    kind: "sales",
    id: row.id,
    createdAt: row.created_at,
    date: row.sale_date,
    summary: `${row.origin} → ${row.destination}`,
    // 매출 목록 카드가 공급가액을 보여주므로 같은 숫자를 쓴다 (합계금액을 쓰면 같은 건이 달라 보임).
    amount: row.supply_amount,
  }
}

export function toDispatchCopyEntry(
  row: Pick<
    DispatchRow,
    | "id"
    | "created_at"
    | "dispatch_date"
    | "origin"
    | "destination"
    | "freight_amount"
  >
): RecentCopyEntry {
  return {
    kind: "dispatches",
    id: row.id,
    createdAt: row.created_at,
    date: row.dispatch_date,
    summary: `${row.origin} → ${row.destination}`,
    amount: row.freight_amount,
  }
}

export function toExpenseCopyEntry(
  row: Pick<
    ExpenseRow,
    | "id"
    | "created_at"
    | "expense_date"
    | "category_major"
    | "category_minor"
    | "amount"
  >
): RecentCopyEntry {
  return {
    kind: "expenses",
    id: row.id,
    createdAt: row.created_at,
    date: row.expense_date,
    summary: `${row.category_major}·${row.category_minor}`,
    amount: row.amount,
  }
}

/** 세 종류의 최근 건을 created_at 최신순으로 합쳐 최대 limit개만 남긴다. */
export function mergeRecentCopyEntries(
  groups: readonly (readonly RecentCopyEntry[])[],
  limit = RECENT_COPY_LIMIT
): RecentCopyEntry[] {
  return groups
    .flat()
    .sort((a, b) => {
      const diff = Date.parse(b.createdAt) - Date.parse(a.createdAt)
      if (diff !== 0 && !Number.isNaN(diff)) return diff
      // 밀리초까지 같으면(마이크로초 차이) 문자열 비교로 순서를 고정한다.
      return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
    })
    .slice(0, limit)
}

export function getCopyHref(kind: QuickEntryKind, id: string): string {
  return `/${kind}/new?copy=${encodeURIComponent(id)}`
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * `?copy=` 쿼리값을 검증한다. UUID 형식이 아니면 null (복사 없이 빈 폼).
 * 같은 키가 여러 번 오면(`?copy=a&copy=b`) 첫 값만 본다.
 */
export function parseCopyId(
  raw: string | string[] | undefined
): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return null
  const trimmed = value.trim()
  return UUID_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null
}
