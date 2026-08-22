import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

/**
 * 4.2 삭제 정책 — 소프트 삭제 대상 테이블.
 * DB의 soft_delete()/restore_deleted() 함수(20260730000003 마이그레이션)의
 * 허용 목록과 반드시 일치해야 한다.
 */
export const SOFT_DELETABLE_TABLES = [
  "clients",
  "vehicles",
  "dispatches",
  "sales",
  "expenses",
  "tax_invoices",
  "purchase_invoices",
] as const

export type SoftDeletableTable = (typeof SOFT_DELETABLE_TABLES)[number]

/**
 * 소프트 삭제: deleted_at 기록 + audit_logs(DELETE) 기록을 하나의 DB 트랜잭션으로 처리한다.
 * 실제 삭제(DELETE)는 수행하지 않는다.
 */
export async function softDelete(
  supabase: SupabaseClient<Database>,
  table: SoftDeletableTable,
  recordId: string
): Promise<void> {
  const { error } = await supabase.rpc("soft_delete", {
    p_table_name: table,
    p_record_id: recordId,
  })

  if (error) {
    throw new Error(`삭제 실패: ${error.message}`)
  }
}

/**
 * 휴지통 복구: deleted_at = NULL + audit_logs(RESTORE) 기록을 하나의 DB 트랜잭션으로 처리한다.
 */
export async function restoreRecord(
  supabase: SupabaseClient<Database>,
  table: SoftDeletableTable,
  recordId: string
): Promise<void> {
  const { error } = await supabase.rpc("restore_deleted", {
    p_table_name: table,
    p_record_id: recordId,
  })

  if (error) {
    throw new Error(`복구 실패: ${error.message}`)
  }
}
