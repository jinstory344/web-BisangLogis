"use server"

import { revalidatePath } from "next/cache"

import { recordAuditLog } from "@/lib/audit/log"
import { createClient } from "@/lib/supabase/server"
import type { MemoKind, MemoRow } from "@/lib/supabase/database.types"

export type MemoItem = Pick<
  MemoRow,
  "id" | "kind" | "client_id" | "title" | "body" | "pinned" | "sort_order" | "created_at" | "updated_at"
>

export type MemoResult = { ok: true; memo: MemoItem } | { ok: false; error: string }

const COLUMNS = "id, kind, client_id, title, body, pinned, sort_order, created_at, updated_at"

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
  if (!["DISPATCH", "WORK", "ORDER"].includes(input.kind)) return { ok: false, error: "메모 종류가 잘못됐어요" }

  const values = {
    kind: input.kind,
    client_id: input.client_id || null,
    title,
    body: input.body,
    pinned: input.pinned,
  }
  const supabase = await createClient()

  if (!input.id) {
    // 새 메모는 맨 위로: 지금 가장 작은 순서보다 10 작게
    const { data: first } = await supabase
      .from("memos")
      .select("sort_order")
      .is("deleted_at", null)
      .order("sort_order")
      .limit(1)
    const sort_order = (first?.[0]?.sort_order ?? 10) - 10
    const { data, error } = await supabase
      .from("memos")
      .insert({ ...values, sort_order })
      .select(COLUMNS)
      .single()
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

/** ★ 고정만 바로 켜고 끄기 (고치기 화면의 별표 — 저장을 누르지 않아도 된다) */
export async function setMemoPinnedAction(id: string, pinned: boolean): Promise<MemoResult> {
  const supabase = await createClient()
  const { data: before } = await supabase.from("memos").select(COLUMNS).eq("id", id).single()
  const { data, error } = await supabase
    .from("memos")
    .update({ pinned })
    .eq("id", id)
    .is("deleted_at", null)
    .select(COLUMNS)
    .single()
  if (error) return { ok: false, error: `고정 실패: ${error.message}` }
  await recordAuditLog(supabase, {
    tableName: "memos",
    recordId: id,
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

/** 두 메모의 순서를 맞바꾼다 (보이는 목록에서 한 칸 위·아래로 옮기기). 맞바꾼 뒤 두 메모를 돌려준다. */
export async function swapMemoOrderAction(
  id: string,
  otherId: string
): Promise<{ ok: true; memos: MemoItem[] } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from("memos")
    .select(COLUMNS)
    .in("id", [id, otherId])
    .is("deleted_at", null)
  if (error || !rows || rows.length !== 2) return { ok: false, error: "메모를 찾지 못했어요" }
  const [a, b] = rows
  // 두 순서가 같으면 바꿔도 그대로라 한쪽을 하나 더 띄운다
  const aOrder = b.sort_order
  const bOrder = a.sort_order === b.sort_order ? a.sort_order + (a.id === id ? 1 : -1) : a.sort_order
  const updated: MemoItem[] = []
  for (const [row, sort_order] of [
    [a, aOrder],
    [b, bOrder],
  ] as const) {
    const { data, error: updateError } = await supabase
      .from("memos")
      .update({ sort_order })
      .eq("id", row.id)
      .select(COLUMNS)
      .single()
    if (updateError) return { ok: false, error: `순서 바꾸기 실패: ${updateError.message}` }
    await recordAuditLog(supabase, {
      tableName: "memos",
      recordId: row.id,
      action: "UPDATE",
      beforeData: { sort_order: row.sort_order },
      afterData: { sort_order },
    })
    updated.push(data)
  }
  revalidatePath("/memos")
  return { ok: true, memos: updated }
}
