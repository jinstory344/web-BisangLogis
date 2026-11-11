import { EXPENSE_PAYMENT_METHOD_LABELS } from "@/lib/constants/payment-method"
import type { AmountRow, LedgerEntry } from "@/lib/ledger"
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
        .select(
          "id, created_at, sale_date, origin, destination, supply_amount, payment_status, source_major, source_minor"
        )
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
        .select(
          "id, created_at, expense_date, category_major, category_minor, amount, payment_method, vendor, memo"
        )
        .is("deleted_at", null)
        .gte("expense_date", from)
        .lte("expense_date", to)
        .order("expense_date")
        .order("id")
        .range(a, b)
    ),
  ])

  const saleEntries: SaleLedgerEntry[] = sales.map((row) => ({
    kind: "sale",
    id: row.id,
    date: row.sale_date,
    createdAt: row.created_at,
    amount: row.supply_amount,
    source: row.source_minor || row.source_major || "-",
    route: `${row.origin} → ${row.destination}`,
    sourceMajor: row.source_major ?? "-",
    isUnpaid: row.payment_status === "UNPAID",
  }))

  const expenseEntries: ExpenseLedgerEntry[] = expenses.map((row) => ({
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
  }))

  return [...saleEntries, ...expenseEntries]
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
