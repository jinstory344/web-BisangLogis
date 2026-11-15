import type { SupabaseClient } from "@supabase/supabase-js"

import { recordAuditLog } from "@/lib/audit/log"
import { splitInstallments, summarizeInstallmentGroup } from "@/lib/installment"
import { softDelete } from "@/lib/soft-delete/soft-delete"
import type { Database, ExpenseRow } from "@/lib/supabase/database.types"

type Client = SupabaseClient<Database>

/** 저장할 지출 값 (금액은 총액, 할부면 회차로 나눠 여러 줄이 된다) */
export type ExpenseInsert = Omit<
  ExpenseRow,
  "id" | "created_at" | "updated_at" | "deleted_at" | "installment_group_id" | "installment_no"
>

/**
 * 지출을 저장한다. 할부(2개월 이상)면 회차마다 한 줄씩 한 번에 넣는다(한 문장이라 일부만 들어가지 않는다).
 * 넣은 줄 id들을 회차 순서로 돌려준다(첫 번째가 1회차).
 */
export async function insertExpenseWithInstallments(
  supabase: Client,
  values: ExpenseInsert
): Promise<{ ids: string[]; rows: ExpenseInsert[] } | { error: string }> {
  const parts = splitInstallments(values, crypto.randomUUID())
  const rows = parts.map((part) => ({ ...values, ...part }))
  const { data, error } = await supabase.from("expenses").insert(rows).select("*")
  if (error || !data) return { error: error?.message ?? "저장 실패" }

  const sorted = [...data].sort((a, b) => (a.installment_no ?? 0) - (b.installment_no ?? 0))
  for (const row of sorted) {
    await recordAuditLog(supabase, {
      tableName: "expenses",
      recordId: row.id,
      action: "CREATE",
      afterData: row,
    })
  }
  return { ids: sorted.map((row) => row.id), rows }
}

/** 이 지출과 같은 할부의 (삭제 안 된) 줄들. 일시불이면 그 한 줄만. */
export async function getExpenseGroupRows(supabase: Client, id: string): Promise<ExpenseRow[]> {
  const { data: row } = await supabase.from("expenses").select("*").eq("id", id).maybeSingle()
  if (!row) return []
  if (!row.installment_group_id) return row.deleted_at ? [] : [row]
  const { data } = await supabase
    .from("expenses")
    .select("*")
    .eq("installment_group_id", row.installment_group_id)
    .is("deleted_at", null)
    .order("installment_no")
  return data ?? []
}

/** 지출 삭제(소프트). 할부 회차 하나를 지우면 그 할부 전체가 함께 지워진다. 지운 줄 수를 돌려준다. */
export async function softDeleteExpense(supabase: Client, id: string): Promise<number> {
  const rows = await getExpenseGroupRows(supabase, id)
  const ids = rows.length > 0 ? rows.map((row) => row.id) : [id]
  for (const rowId of ids) await softDelete(supabase, "expenses", rowId)
  return ids.length
}

/**
 * 수정·복사 화면에 띄울 지출: 할부 회차면 묶음 전체를 한 건처럼 — 첫 회차 날짜와 총액.
 * 없거나 삭제된 건이면 null.
 */
export async function loadExpenseForForm(
  supabase: Client,
  id: string
): Promise<{ row: ExpenseRow; groupSize: number } | null> {
  const rows = await getExpenseGroupRows(supabase, id)
  const self = rows.find((row) => row.id === id)
  if (!self) return null
  const summary = summarizeInstallmentGroup(rows)
  return {
    row: summary && self.installment_group_id ? { ...self, ...summary } : self,
    groupSize: rows.length,
  }
}
