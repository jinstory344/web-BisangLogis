"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { recordAuditLog } from "@/lib/audit/log"
import { nullifyEmptyStrings } from "@/lib/nullify-empty"
import { softDelete } from "@/lib/soft-delete/soft-delete"
import { createClient } from "@/lib/supabase/server"
import { clientFormSchema } from "@/lib/validations/client"

export interface ClientSearchResult {
  id: string
  name: string
  biz_no: string | null
}

/** 2.2 거래처 자동완성: 사업자명/사업자번호로 검색 */
export async function searchClientsAction(
  query: string
): Promise<ClientSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, biz_no")
    .is("deleted_at", null)
    .or(`name.ilike.%${trimmed}%,biz_no.ilike.%${trimmed}%`)
    .order("name")
    .limit(20)

  if (error) {
    throw new Error(`거래처 검색 실패: ${error.message}`)
  }

  return data
}

/** 2.2 거래처 콤보박스에서 "미등록 시 즉시 신규 등록" — 사업자명만으로 최소 생성 */
export async function quickCreateClientAction(
  name: string
): Promise<ClientSearchResult> {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error("사업자명을 입력하세요")
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("clients")
    .insert({ name: trimmed })
    .select("id, name, biz_no")
    .single()

  if (error) {
    throw new Error(`거래처 등록 실패: ${error.message}`)
  }

  await recordAuditLog(supabase, {
    tableName: "clients",
    recordId: data.id,
    action: "CREATE",
    afterData: { name: trimmed },
  })

  revalidatePath("/clients")
  return data
}

export interface ClientActionState {
  error: string | null
}

export async function createClientAction(
  _prevState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  const parsed = clientFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" }
  }

  const supabase = await createClient()
  const { name, ...optional } = parsed.data
  const values = { name, ...nullifyEmptyStrings(optional) }

  const { data, error } = await supabase
    .from("clients")
    .insert(values)
    .select("id")
    .single()

  if (error) {
    return { error: `저장 실패: ${error.message}` }
  }

  await recordAuditLog(supabase, {
    tableName: "clients",
    recordId: data.id,
    action: "CREATE",
    afterData: values,
  })

  revalidatePath("/clients")
  redirect("/clients")
}

export async function updateClientAction(
  id: string,
  _prevState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  const parsed = clientFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" }
  }

  const supabase = await createClient()
  const { name, ...optional } = parsed.data
  const values = { name, ...nullifyEmptyStrings(optional) }

  const { data: before, error: fetchError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchError || !before) {
    return { error: "대상 거래처를 찾을 수 없습니다" }
  }

  const { error } = await supabase.from("clients").update(values).eq("id", id)

  if (error) {
    return { error: `저장 실패: ${error.message}` }
  }

  await recordAuditLog(supabase, {
    tableName: "clients",
    recordId: id,
    action: "UPDATE",
    beforeData: before,
    afterData: { ...before, ...values },
  })

  revalidatePath("/clients")
  redirect("/clients")
}

/** 7.5: 배차 이력이 있으면 삭제 전 경고 표시용 건수 조회 */
export async function getClientDispatchCount(id: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("dispatches")
    .select("id", { count: "exact", head: true })
    .eq("client_id", id)
    .is("deleted_at", null)

  if (error) {
    throw new Error(`배차 이력 조회 실패: ${error.message}`)
  }

  return count ?? 0
}

export async function deleteClientAction(id: string): Promise<void> {
  const supabase = await createClient()
  await softDelete(supabase, "clients", id)
  revalidatePath("/clients")
}
