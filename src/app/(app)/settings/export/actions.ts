"use server"

import { createClient } from "@/lib/supabase/server"
import type { ExportKind } from "@/lib/excel-export"

/** 내보내기 화면의 종류별 건수 (기간 안, 지운 것 빼고). 거래처·차량은 기간과 상관없이 전부. */
export async function exportCountsAction(
  period: { from: string; to: string } | null
): Promise<Record<ExportKind, number>> {
  const supabase = await createClient()
  const dated = (table: "sales" | "expenses" | "dispatches", col: string) => {
    let q = supabase.from(table).select("id", { count: "exact", head: true }).is("deleted_at", null)
    if (period) q = q.gte(col, period.from).lte(col, period.to)
    return q
  }
  const [sale, expense, dispatch, client, vehicle] = await Promise.all([
    dated("sales", "sale_date"),
    dated("expenses", "expense_date"),
    dated("dispatches", "dispatch_date"),
    supabase.from("clients").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).is("deleted_at", null),
  ])
  return {
    sale: sale.count ?? 0,
    expense: expense.count ?? 0,
    dispatch: dispatch.count ?? 0,
    client: client.count ?? 0,
    vehicle: vehicle.count ?? 0,
  }
}
