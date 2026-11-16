"use server"

import { revalidatePath } from "next/cache"

import { recordAuditLog } from "@/lib/audit/log"
import { createClient } from "@/lib/supabase/server"
import type { MemoKind, MemoRow } from "@/lib/supabase/database.types"

export type MemoItem = Pick<
  MemoRow,
  "id" | "kind" | "client_id" | "title" | "body" | "pinned" | "created_at" | "updated_at"
>

export type MemoResult = { ok: true; memo: MemoItem } | { ok: false; error: string }

const COLUMNS = "id, kind, client_id, title, body, pinned, created_at, updated_at"

/** 메모 목록 (삭제 안 된 것). kind를 주면 그 종류만. */
export async function listMemosAction(kind?: MemoKind): Promise<MemoItem[]> {
  const supabase = await createClient()
  let query = supabase.from("memos").select(COLUMNS).is("deleted_at", null)
  if (kind) query = query.eq("kind", kind)
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1000)
  if (error) throw new Error(`메모 목록 실패: ${error.message}`)
  return data
}

/** 새 메모(id 없음) 또는 고치기. 제목 1~100자, 내용 5000자까지. */
export async function saveMemoAction(input: {
  id?: string
  kind: MemoKind
  client_id: string | null
  title: string
  body: string
  pinned: boolean
}): Promise<MemoResult> {
  const title = input.title.trim()
  if (!title) return { ok: false, error: "제목을 입력하세요" }
  if (title.length > 100) return { ok: false, error: "제목은 100자까지예요" }
  if (input.body.length > 5000) return { ok: false, error: "내용은 5000자까지예요" }
  if (input.kind !== "DISPATCH" && input.kind !== "WORK") return { ok: false, error: "메모 종류가 잘못됐어요" }

  const values = {
    kind: input.kind,
    client_id: input.client_id || null,
    title,
    body: input.body,
    pinned: input.pinned,
  }
  const supabase = await createClient()

  if (!input.id) {
    const { data, error } = await supabase.from("memos").insert(values).select(COLUMNS).single()
    if (error) return { ok: false, error: `메모 저장 실패: ${error.message}` }
    await recordAuditLog(supabase, { tableName: "memos", recordId: data.id, action: "CREATE", afterData: data })
    revalidatePath("/memos")
    return { ok: true, memo: data }
  }

  const { data: before } = await supabase.from("memos").select(COLUMNS).eq("id", input.id).single()
  const { data, error } = await supabase
    .from("memos")
    .update(values)
    .eq("id", input.id)
    .is("deleted_at", null)
    .select(COLUMNS)
    .single()
  if (error) return { ok: false, error: `메모 저장 실패: ${error.message}` }
  await recordAuditLog(supabase, {
    tableName: "memos",
    recordId: data.id,
    action: "UPDATE",
    beforeData: before,
    afterData: data,
  })
  revalidatePath("/memos")
  return { ok: true, memo: data }
}

/** 메모 지우기 (소프트 삭제) */
export async function deleteMemoAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: before } = await supabase.from("memos").select(COLUMNS).eq("id", id).single()
  const { error } = await supabase
    .from("memos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return { ok: false, error: `메모 삭제 실패: ${error.message}` }
  await recordAuditLog(supabase, { tableName: "memos", recordId: id, action: "DELETE", beforeData: before })
  revalidatePath("/memos")
  return { ok: true }
}
