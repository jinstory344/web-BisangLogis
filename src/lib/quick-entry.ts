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
/** 시트에서 검색·"자주 쓰는 건" 계산을 위해 종류별로 읽어올 최신 행 수 */
export const QUICK_SCAN_SIZE = 300
/** 시트 "최근 건"/검색 결과를 처음 보여주는 개수, "더 보기"를 누를 때마다 늘리는 개수, 최대 개수 */
export const QUICK_LIST_PAGE_SIZE = 5
export const QUICK_LIST_STEP = 10
export const QUICK_LIST_MAX = 100
/** "자주 쓰는 건": 같은 유형을 이 횟수 이상 등록했을 때만, 최대 이 개수까지 */
export const FREQUENT_MIN_COUNT = 2
export const FREQUENT_COPY_LIMIT = 5

/** 시트에서 종류를 좁히는 필터 */
export type QuickKindFilter = QuickEntryKind | "all"

/** 화면에 보여주는 순서 (하단 탭과 같은 매출 → 지출 → 배차) */
export const QUICK_ENTRY_ORDER: readonly QuickEntryKind[] = [
  "sales",
  "expenses",
  "dispatches",
]

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

/** created_at 최신순 비교. 밀리초까지 같으면(마이크로초 차이) 문자열 비교로 순서를 고정한다. */
function compareNewestFirst(a: { createdAt: string }, b: { createdAt: string }) {
  const diff = Date.parse(b.createdAt) - Date.parse(a.createdAt)
  if (diff !== 0 && !Number.isNaN(diff)) return diff
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
}

/**
 * 시트의 "최근 건"·검색·"자주 쓰는 건"이 함께 쓰는 한 줄 + 검색/묶음용 값.
 * search에는 전화번호 같은 개인정보를 넣지 않는다 — 구간·거래처·출처·분류·차량번호·기사명·메모·금액만.
 */
export interface CopyCandidate extends RecentCopyEntry {
  /** 검색 대상 문자열(정규화됨): 종류 이름 + 위 값들 + 금액(숫자·쉼표 표기 둘 다) */
  search: string
  /** "자주 쓰는 건" 묶음 키: 같은 구간·분류면 같은 키 */
  group: string
}

/** 검색 비교용 정규화: 한글 조합 형태 통일 + 소문자 */
function normalizeSearchText(text: string): string {
  return text.normalize("NFC").toLowerCase()
}

function withThousands(amount: number): string {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

function buildSearchText(
  kind: QuickEntryKind,
  parts: readonly (string | null | undefined)[],
  amount: number | null
): string {
  const amountParts =
    amount === null ? [] : [String(amount), withThousands(amount)]
  return normalizeSearchText(
    [QUICK_ENTRY_LABELS[kind], ...parts, ...amountParts]
      .map((part) => (part ?? "").trim())
      .filter(Boolean)
      .join(" ")
  )
}

export function toSaleCandidate(
  row: Pick<
    SaleRow,
    | "id"
    | "created_at"
    | "sale_date"
    | "origin"
    | "destination"
    | "supply_amount"
    | "source_major"
    | "source_minor"
    | "source_note"
    | "billing_entity_name"
    | "memo"
  >
): CopyCandidate {
  const entry = toSaleCopyEntry(row)
  return {
    ...entry,
    search: buildSearchText(
      "sales",
      [
        row.origin,
        row.destination,
        row.source_major,
        row.source_minor,
        row.source_note,
        row.billing_entity_name,
        row.memo,
      ],
      entry.amount
    ),
    group: JSON.stringify([
      "sales",
      row.origin.trim(),
      row.destination.trim(),
      row.source_major ?? "",
      row.source_minor ?? "",
    ]),
  }
}

export function toDispatchCandidate(
  row: Pick<
    DispatchRow,
    | "id"
    | "created_at"
    | "dispatch_date"
    | "origin"
    | "destination"
    | "freight_amount"
    | "client_id"
    | "contact_name"
    | "plate_no_snapshot"
    | "driver_name_snapshot"
    | "memo"
  >,
  clientName: string | null
): CopyCandidate {
  const entry = toDispatchCopyEntry(row)
  return {
    ...entry,
    search: buildSearchText(
      "dispatches",
      [
        clientName,
        row.contact_name,
        row.origin,
        row.destination,
        row.plate_no_snapshot,
        row.driver_name_snapshot,
        row.memo,
      ],
      entry.amount
    ),
    group: JSON.stringify([
      "dispatches",
      row.client_id ?? "",
      row.origin.trim(),
      row.destination.trim(),
    ]),
  }
}

export function toExpenseCandidate(
  row: Pick<
    ExpenseRow,
    | "id"
    | "created_at"
    | "expense_date"
    | "category_major"
    | "category_minor"
    | "amount"
    | "payment_method"
    | "vendor"
    | "memo"
  >
): CopyCandidate {
  const entry = toExpenseCopyEntry(row)
  return {
    ...entry,
    search: buildSearchText(
      "expenses",
      [row.category_major, row.category_minor, row.vendor, row.memo],
      entry.amount
    ),
    group: JSON.stringify([
      "expenses",
      row.category_major,
      row.category_minor,
      row.payment_method ?? "",
    ]),
  }
}

/**
 * 검색어의 공백으로 나눈 낱말이 모두 들어 있어야 일치한다(순서·대소문자 무관).
 * 검색어가 비어 있으면 전부 일치.
 */
export function matchesQuery(search: string, query: string): boolean {
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean)
  return tokens.every((token) => search.includes(token))
}

export interface CopySearchResult {
  /** 최신순으로 limit개까지 */
  entries: CopyCandidate[]
  /** limit을 적용하기 전 일치 건수 */
  total: number
}

/** 종류·검색어로 거른 뒤 created_at 최신순으로 정렬해 limit개만 돌려준다 (검색어가 비면 최근 건). */
export function searchCandidates(
  candidates: readonly CopyCandidate[],
  options: { kind?: QuickKindFilter; query?: string; limit: number }
): CopySearchResult {
  const { kind = "all", query = "", limit } = options
  const matched = candidates
    .filter((candidate) => kind === "all" || candidate.kind === kind)
    .filter((candidate) => matchesQuery(candidate.search, query))
    .sort(compareNewestFirst)

  return { entries: matched.slice(0, Math.max(limit, 0)), total: matched.length }
}

export interface FrequentCopyEntry extends CopyCandidate {
  /** 같은 유형으로 등록한 횟수 */
  count: number
}

/**
 * "자주 쓰는 건": 같은 유형(group 키 — 매출·배차는 구간(+거래처/출처), 지출은 분류+결제방법)이
 * minCount번 이상인 묶음을 횟수 많은 순(같으면 최근 순)으로 limit개. 각 묶음은 가장 최근 건을 대표로
 * 보여주므로 [복사]하면 가장 최근에 쓴 값이 채워진다.
 */
export function pickFrequentCandidates(
  candidates: readonly CopyCandidate[],
  options: {
    kind?: QuickKindFilter
    limit?: number
    minCount?: number
  } = {}
): FrequentCopyEntry[] {
  const {
    kind = "all",
    limit = FREQUENT_COPY_LIMIT,
    minCount = FREQUENT_MIN_COUNT,
  } = options

  const groups = new Map<string, { latest: CopyCandidate; count: number }>()
  for (const candidate of candidates) {
    if (kind !== "all" && candidate.kind !== kind) continue

    const existing = groups.get(candidate.group)
    if (!existing) {
      groups.set(candidate.group, { latest: candidate, count: 1 })
      continue
    }
    existing.count += 1
    if (compareNewestFirst(candidate, existing.latest) < 0) {
      existing.latest = candidate
    }
  }

  return [...groups.values()]
    .filter((group) => group.count >= minCount)
    .sort(
      (a, b) => b.count - a.count || compareNewestFirst(a.latest, b.latest)
    )
    .slice(0, Math.max(limit, 0))
    .map((group) => ({ ...group.latest, count: group.count }))
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
