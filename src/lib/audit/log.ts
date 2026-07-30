import type { SupabaseClient } from "@supabase/supabase-js"

import type { AuditAction, Database } from "@/lib/supabase/database.types"

export interface RecordAuditLogParams {
  tableName: string
  recordId: string
  action: AuditAction
  beforeData?: Record<string, unknown> | null
  afterData?: Record<string, unknown> | null
}

/**
 * 4.3.7 변경 이력 로그. actor_id는 DB의 write_audit_log() 함수 내부에서
 * auth.uid()로 직접 채운다 (클라이언트가 임의로 위조할 수 없도록).
 *
 * CREATE/UPDATE처럼 대상 테이블마다 컬럼이 달라 범용화하기 어려운 작업은
 * 이 헬퍼로 insert/update 직후 별도 호출한다. DELETE/RESTORE는
 * soft-delete.ts의 softDelete/restoreDeleted가 대상 테이블 갱신과
 * 감사 로그 기록을 하나의 DB 함수(트랜잭션)로 원자적으로 처리한다.
 */
export async function recordAuditLog(
  supabase: SupabaseClient<Database>,
  params: RecordAuditLogParams
): Promise<void> {
  const { error } = await supabase.rpc("write_audit_log", {
    p_table_name: params.tableName,
    p_record_id: params.recordId,
    p_action: params.action,
    p_before_data: params.beforeData ?? null,
    p_after_data: params.afterData ?? null,
  })

  if (error) {
    throw new Error(`감사 로그 기록 실패: ${error.message}`)
  }
}
