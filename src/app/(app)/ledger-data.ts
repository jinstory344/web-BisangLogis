import { EXPENSE_PAYMENT_METHOD_LABELS } from "@/lib/constants/payment-method"
import { formatSaleSource } from "@/lib/constants/sale-sources"
import type { AmountRow, LedgerEntry } from "@/lib/ledger"
import { appendClientIdFilter, buildIlikeOrFilter } from "@/lib/search"
import type { ExpenseRow, SaleRow } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

type Supabase = Awaited<ReturnType<typeof createClient>>

/** Supabase가 한 번에 돌려주는 최대 행 수. 이보다 많으면 나눠서 끝까지 읽는다. */
const PAGE_SIZE = 1000

interface PageResult<T> {
  data: T[] | null
  error: { message: string } | null
}

/** 한 번에 PAGE_SIZE행씩 끝까지 읽는다 (행 수 제한 때문에 합계가 잘리는 일을 막는다). */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

/** 기간 안의 매출(공급가액)·지출을 금액 한 건씩 읽는다 (주별·월별·연별 합계와 상단 합계용). */
export async function fetchAmountRows(
  supabase: Supabase,
  from: string,
  to: string
): Promise<AmountRow[]> {
  const [sales, expenses] = await Promise.all([
    fetchAllRows((a, b) =>
      supabase
        .from("sales")
        .select("sale_date, supply_amount")
        .is("deleted_at", null)
        .gte("sale_date", from)
        .lte("sale_date", to)
        .order("sale_date")
        .order("id")
        .range(a, b)
    ),
    fetchAllRows((a, b) =>
      supabase
        .from("expenses")
        .select("expense_date, amount")
        .is("deleted_at", null)
        .gte("expense_date", from)
        .lte("expense_date", to)
        .order("expense_date")
        .order("id")
        .range(a, b)
    ),
  ])

  return [
    ...sales.map((row) => ({
      date: row.sale_date,
      income: row.supply_amount,
      expense: 0,
    })),
    ...expenses.map((row) => ({
      date: row.expense_date,
      income: 0,
      expense: row.amount,
    })),
  ]
}

export interface SaleLedgerEntry extends LedgerEntry {
  kind: "sale"
  /** 출처 이름(소분류, 없으면 대분류) */
  source: string
  /** "상차지 → 하차지" */
  route: string
  sourceMajor: string
  isUnpaid: boolean
  /** 작업 시트용 원래 행 */
  row: SaleRow
}

export interface ExpenseLedgerEntry extends LedgerEntry {
  kind: "expense"
  major: string
  minor: string
  /** 사용처·비고를 한 줄로 */
  note: string
  /** "카드" 등 */
  paymentLabel: string
  /** 작업 시트용 원래 행 */
  row: ExpenseRow
}

export type DayLedgerEntry = SaleLedgerEntry | ExpenseLedgerEntry

/**
 * 일일 장부·검색은 건을 누르면 뜨는 작업 시트(입금 처리·상세·수정·복사·삭제)에
 * 세액·합계금액·입금일·결제수단 등이 필요해서 행 전체를 읽는다.
 */
const SALE_ENTRY_COLUMNS = "*"
const EXPENSE_ENTRY_COLUMNS = "*"

function toSaleEntry(row: SaleRow): SaleLedgerEntry {
  return {
    kind: "sale",
    id: row.id,
    date: row.sale_date,
    createdAt: row.created_at,
    amount: row.supply_amount,
    source: row.source_minor || row.source_major || "-",
    route: `${row.origin} → ${row.destination}`,
    sourceMajor: formatSaleSource(row.source_major, row.source_sub) || "-",
    isUnpaid: row.payment_status === "UNPAID",
    row,
  }
}

function toExpenseEntry(row: ExpenseRow): ExpenseLedgerEntry {
  return {
    kind: "expense",
    id: row.id,
    date: row.expense_date,
    createdAt: row.created_at,
    amount: row.amount,
    major: row.category_major,
    minor: row.category_minor,
    note: [row.vendor, row.memo]
      .map((text) => text?.trim())
      .filter(Boolean)
      .join(" · "),
    paymentLabel: row.payment_method
      ? EXPENSE_PAYMENT_METHOD_LABELS[row.payment_method]
      : "",
    row,
  }
}

/** 일일 장부에 보여 줄 기간 안의 매출·지출을 한 건씩 읽는다. */
export async function fetchLedgerEntries(
  supabase: Supabase,
  from: string,
  to: string
): Promise<DayLedgerEntry[]> {
  const [sales, expenses] = await Promise.all([
    fetchAllRows((a, b) =>
      supabase
        .from("sales")
        .select(SALE_ENTRY_COLUMNS)
        .is("deleted_at", null)
        .gte("sale_date", from)
        .lte("sale_date", to)
        .order("sale_date")
        .order("id")
        .range(a, b)
    ),
    fetchAllRows((a, b) =>
      supabase
        .from("expenses")
        .select(EXPENSE_ENTRY_COLUMNS)
        .is("deleted_at", null)
        .gte("expense_date", from)
        .lte("expense_date", to)
        .order("expense_date")
        .order("id")
        .range(a, b)
    ),
  ])

  return [...sales.map(toSaleEntry), ...expenses.map(toExpenseEntry)]
}

/** 검색 결과 최대 건수 (매출·지출 각각) */
/** 통합검색에서 종류마다 가져오는 최대 건수 (달별로 접어 보여 준다) */
export const SEARCH_RESULT_LIMIT = 300

/**
 * 통합검색: 매출·지출을 글자와 기간으로 찾는다 (최근 날짜부터, 종류마다 최대 SEARCH_RESULT_LIMIT건).
 * 매출: 상차지·하차지·출처·계산서정보·비고 / 지출: 대분류·소분류·사용처·비고.
 * clientIds가 있으면 그 거래처에 연결된 매출도 함께 찾는다(거래처 이름 검색).
 * query가 비어 있으면 글자 조건 없이 기간만으로 찾는다. query는 normalizeSearchQuery로 다듬은 값이어야 한다.
 */
export async function searchLedgerEntries(
  supabase: Supabase,
  query: string,
  clientIds: readonly string[] = [],
  period: { from: string; to: string } | null = null
): Promise<{ entries: DayLedgerEntry[]; isTruncated: boolean }> {
  let sales = supabase.from("sales").select(SALE_ENTRY_COLUMNS).is("deleted_at", null)
  let expenses = supabase.from("expenses").select(EXPENSE_ENTRY_COLUMNS).is("deleted_at", null)
  if (query) {
    sales = sales.or(
      appendClientIdFilter(
        buildIlikeOrFilter(
          ["origin", "destination", "source_major", "source_sub", "source_minor", "billing_entity_name", "memo"],
          query
        ),
        clientIds
      )
    )
    expenses = expenses.or(buildIlikeOrFilter(["category_major", "category_minor", "vendor", "memo"], query))
  }
  if (period) {
    sales = sales.gte("sale_date", period.from).lte("sale_date", period.to)
    expenses = expenses.gte("expense_date", period.from).lte("expense_date", period.to)
  }
  const [saleRes, expenseRes] = await Promise.all([
    sales.order("sale_date", { ascending: false }).order("id").limit(SEARCH_RESULT_LIMIT),
    expenses.order("expense_date", { ascending: false }).order("id").limit(SEARCH_RESULT_LIMIT),
  ])
  if (saleRes.error) throw new Error(saleRes.error.message)
  if (expenseRes.error) throw new Error(expenseRes.error.message)

  const saleRows = saleRes.data ?? []
  const expenseRows = expenseRes.data ?? []
  return {
    entries: [...saleRows.map(toSaleEntry), ...expenseRows.map(toExpenseEntry)],
    isTruncated:
      saleRows.length >= SEARCH_RESULT_LIMIT ||
      expenseRows.length >= SEARCH_RESULT_LIMIT,
  }
}

/** 통합검색 합계·건수: 목록은 SEARCH_RESULT_LIMIT건까지만 보여도 합계는 조건에 맞는 전부로 센다(금액 칸만 읽음). */
export async function searchLedgerTotals(
  supabase: Supabase,
  query: string,
  clientIds: readonly string[],
  period: { from: string; to: string } | null
): Promise<{ sale: { count: number; amount: number; unpaid: number }; expense: { count: number; amount: number } }> {
  const [saleRows, expenseRows] = await Promise.all([
    fetchAllRows((a, b) => {
      let q = supabase.from("sales").select("supply_amount, payment_status").is("deleted_at", null)
      if (query) q = q.or(appendClientIdFilter(buildIlikeOrFilter(["origin", "destination", "source_major", "source_sub", "source_minor", "billing_entity_name", "memo"], query), clientIds))
      if (period) q = q.gte("sale_date", period.from).lte("sale_date", period.to)
      return q.order("id").range(a, b)
    }),
    fetchAllRows((a, b) => {
      let q = supabase.from("expenses").select("amount").is("deleted_at", null)
      if (query) q = q.or(buildIlikeOrFilter(["category_major", "category_minor", "vendor", "memo"], query))
      if (period) q = q.gte("expense_date", period.from).lte("expense_date", period.to)
      return q.order("id").range(a, b)
    }),
  ])
  return {
    sale: {
      count: saleRows.length,
      amount: saleRows.reduce((sum, r) => sum + r.supply_amount, 0),
      unpaid: saleRows.reduce((sum, r) => sum + (r.payment_status === "UNPAID" ? r.supply_amount : 0), 0),
    },
    expense: { count: expenseRows.length, amount: expenseRows.reduce((sum, r) => sum + r.amount, 0) },
  }
}

/** 아직 입금되지 않은 매출 전체(기간과 상관없이)의 건수와 공급가액 합계 — 미수금 */
export async function fetchUnpaidSummary(
  supabase: Supabase,
  from: string,
  to: string
): Promise<{ count: number; supplyAmount: number }> {
  const rows = await fetchAllRows((a, b) =>
    supabase
      .from("sales")
      .select("supply_amount")
      .is("deleted_at", null)
      .eq("payment_status", "UNPAID")
      .gte("sale_date", from)
      .lte("sale_date", to)
      .order("id")
      .range(a, b)
  )
  return {
    count: rows.length,
    supplyAmount: rows.reduce((sum, row) => sum + row.supply_amount, 0),
  }
}
