import { EXPENSE_PAYMENT_METHOD_LABELS } from "@/lib/constants/payment-method"
import type { AmountRow, LedgerEntry } from "@/lib/ledger"
import { buildIlikeOrFilter } from "@/lib/search"
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
async function fetchAllRows<T>(
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
}

export interface ExpenseLedgerEntry extends LedgerEntry {
  kind: "expense"
  major: string
  minor: string
  /** 사용처·비고를 한 줄로 */
  note: string
  /** "카드" 등 */
  paymentLabel: string
}

export type DayLedgerEntry = SaleLedgerEntry | ExpenseLedgerEntry

const SALE_ENTRY_COLUMNS =
  "id, created_at, sale_date, origin, destination, supply_amount, payment_status, source_major, source_minor"
const EXPENSE_ENTRY_COLUMNS =
  "id, created_at, expense_date, category_major, category_minor, amount, payment_method, vendor, memo"

type SaleEntryRow = Pick<
  SaleRow,
  | "id"
  | "created_at"
  | "sale_date"
  | "origin"
  | "destination"
  | "supply_amount"
  | "payment_status"
  | "source_major"
  | "source_minor"
>

type ExpenseEntryRow = Pick<
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

function toSaleEntry(row: SaleEntryRow): SaleLedgerEntry {
  return {
    kind: "sale",
    id: row.id,
    date: row.sale_date,
    createdAt: row.created_at,
    amount: row.supply_amount,
    source: row.source_minor || row.source_major || "-",
    route: `${row.origin} → ${row.destination}`,
    sourceMajor: row.source_major ?? "-",
    isUnpaid: row.payment_status === "UNPAID",
  }
}

function toExpenseEntry(row: ExpenseEntryRow): ExpenseLedgerEntry {
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
export const SEARCH_RESULT_LIMIT = 100

/**
 * 기간과 상관없이 매출·지출을 글자로 찾는다 (최근 날짜부터, 종류마다 최대 SEARCH_RESULT_LIMIT건).
 * 매출: 상차지·하차지·출처·계산서정보·비고 / 지출: 대분류·소분류·사용처·비고.
 * query는 normalizeSearchQuery로 다듬은 값이어야 한다.
 */
export async function searchLedgerEntries(
  supabase: Supabase,
  query: string
): Promise<{ entries: DayLedgerEntry[]; isTruncated: boolean }> {
  const [sales, expenses] = await Promise.all([
    supabase
      .from("sales")
      .select(SALE_ENTRY_COLUMNS)
      .is("deleted_at", null)
      .or(
        buildIlikeOrFilter(
          [
            "origin",
            "destination",
            "source_major",
            "source_minor",
            "billing_entity_name",
            "memo",
          ],
          query
        )
      )
      .order("sale_date", { ascending: false })
      .order("id")
      .limit(SEARCH_RESULT_LIMIT),
    supabase
      .from("expenses")
      .select(EXPENSE_ENTRY_COLUMNS)
      .is("deleted_at", null)
      .or(
        buildIlikeOrFilter(
          ["category_major", "category_minor", "vendor", "memo"],
          query
        )
      )
      .order("expense_date", { ascending: false })
      .order("id")
      .limit(SEARCH_RESULT_LIMIT),
  ])
  if (sales.error) throw new Error(sales.error.message)
  if (expenses.error) throw new Error(expenses.error.message)

  const saleRows = sales.data ?? []
  const expenseRows = expenses.data ?? []
  return {
    entries: [...saleRows.map(toSaleEntry), ...expenseRows.map(toExpenseEntry)],
    isTruncated:
      saleRows.length >= SEARCH_RESULT_LIMIT ||
      expenseRows.length >= SEARCH_RESULT_LIMIT,
  }
}

/** 아직 입금되지 않은 매출 전체(기간과 상관없이)의 건수와 공급가액 합계 — 미수금 */
export async function fetchUnpaidSummary(
  supabase: Supabase
): Promise<{ count: number; supplyAmount: number }> {
  const rows = await fetchAllRows((a, b) =>
    supabase
      .from("sales")
      .select("supply_amount")
      .is("deleted_at", null)
      .eq("payment_status", "UNPAID")
      .order("id")
      .range(a, b)
  )
  return {
    count: rows.length,
    supplyAmount: rows.reduce((sum, row) => sum + row.supply_amount, 0),
  }
}
