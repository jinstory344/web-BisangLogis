"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { TRASH_TABLE, type TrashKind } from "@/lib/trash"

type Target = { kind: TrashKind; id: string }

const KINDS = Object.keys(TRASH_TABLE) as TrashKind[]

/** 복구·완전 삭제 뒤 원래 목록들이 새 내용을 보이게 */
function refreshLists() {
  for (const path of ["/", "/sales", "/expenses", "/dispatches", "/clients", "/vehicles", "/memos", "/trash"]) {
    revalidatePath(path)
  }
}

/** 휴지통에서 되살리기 (여러 건). 실패한 건수와 첫 오류를 돌려준다. */
export async function restoreTrashAction(targets: Target[]): Promise<{ done: number; error: string | null }> {
  const supabase = await createClient()
  let done = 0
  let error: string | null = null
  for (const t of targets) {
    if (!KINDS.includes(t.kind)) continue
    const { error: e } = await supabase.rpc("restore_deleted", { p_table_name: TRASH_TABLE[t.kind], p_record_id: t.id })
    if (e) error ??= e.message
    else done++
  }
  refreshLists()
  return { done, error }
}

/** 휴지통에서 완전 삭제 (되돌릴 수 없음). 기록이 있는 거래처 등은 DB가 막고 오류로 알려 준다. */
export async function purgeTrashAction(targets: Target[]): Promise<{ done: number; error: string | null }> {
  const supabase = await createClient()
  let done = 0
  let error: string | null = null
  for (const t of targets) {
    if (!KINDS.includes(t.kind)) continue
    const { error: e } = await supabase.rpc("purge_deleted", { p_table_name: TRASH_TABLE[t.kind], p_record_id: t.id })
    if (e) error ??= e.message
    else done++
  }
  refreshLists()
  return { done, error }
}
