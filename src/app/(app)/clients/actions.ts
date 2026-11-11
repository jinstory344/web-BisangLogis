"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { recordAuditLog } from "@/lib/audit/log"
import { normalizeBizNo } from "@/lib/biz-no"
import {
  mergeClientDuplicates,
  type ClientDuplicate,
} from "@/lib/client-duplicates"
import {
  DEFAULT_CLIENT_CATEGORY,
  normalizeClientCategory,
} from "@/lib/constants/client"
import { nullifyEmptyStrings } from "@/lib/nullify-empty"
import { softDelete } from "@/lib/soft-delete/soft-delete"
import { createClient } from "@/lib/supabase/server"
import type { ClientCategory } from "@/lib/supabase/database.types"
import { clientFormSchema } from "@/lib/validations/client"

export interface ClientSearchResult {
  id: string
  name: string
  biz_no: string | null
}

/** 2.2 거래처 자동완성: 거래처명/사업자번호로 검색 */
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

/**
 * 2.2 거래처 콤보박스에서 "미등록 시 즉시 신규 등록" — 거래처명만으로 최소 생성.
 * 같은 이름의 거래처가 이미 있으면 새로 만들지 않고 그 거래처를 돌려준다. 검색 결과가 오기 전에
 * "신규 등록"을 누르거나 연속으로 눌러도 같은 이름이 두 개 생기지 않게 하는 안전장치다.
 * 새로 만들 때의 구분은 호출한 화면이 정한다: 배차 화면은 내 거래처(기본), 매출 화면은 타 거래처.
 */
export async function quickCreateClientAction(
  name: string,
  category: ClientCategory = DEFAULT_CLIENT_CATEGORY
): Promise<ClientSearchResult> {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error("거래처명을 입력하세요")
  }
  // 클라이언트가 보낸 값이므로 알 수 없는 값은 기본 구분으로 바꾼다.
  const safeCategory = normalizeClientCategory(category)

  const supabase = await createClient()

  const { data: existing, error: findError } = await supabase
    .from("clients")
    .select("id, name, biz_no")
    .eq("name", trimmed)
    .is("deleted_at", null)
    .order("created_at")
    .limit(1)

  if (findError) {
    throw new Error(`거래처 확인 실패: ${findError.message}`)
  }
  if (existing.length > 0) {
    return existing[0]
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({ name: trimmed, category: safeCategory })
    .select("id, name, biz_no")
    .single()

  if (error) {
    throw new Error(`거래처 등록 실패: ${error.message}`)
  }

  await recordAuditLog(supabase, {
    tableName: "clients",
    recordId: data.id,
    action: "CREATE",
    afterData: { name: trimmed, category: safeCategory },
  })

  revalidatePath("/clients")
  return data
}

/**
 * 거래처 등록·수정 전에 같은 이름 또는 같은 사업자번호의 거래처가 이미 있는지 확인한다.
 * 막지는 않고 화면이 "그래도 저장할까요?"로 확인만 받는다 (본점·지점처럼 같은 번호를 쓰는 경우가 있다).
 * 수정할 때는 자기 자신(excludeId)을 뺀다. 삭제된 거래처는 보지 않는다.
 */
export async function findDuplicateClientsAction(input: {
  name: string
  bizNo: string
  excludeId?: string
}): Promise<ClientDuplicate[]> {
  const name = input.name.trim()
  const bizNo = normalizeBizNo(input.bizNo)
  const supabase = await createClient()

  async function findBy(
    column: "name" | "biz_no",
    value: string
  ): Promise<ClientSearchResult[]> {
    if (!value) return []

    let request = supabase
      .from("clients")
      .select("id, name, biz_no")
      .eq(column, value)
      .is("deleted_at", null)
      .limit(5)
    if (input.excludeId) {
      request = request.neq("id", input.excludeId)
    }

    const { data, error } = await request
    if (error) {
      throw new Error(`거래처 중복 확인 실패: ${error.message}`)
    }
    return data
  }

  const [sameName, sameBizNo] = await Promise.all([
    findBy("name", name),
    findBy("biz_no", bizNo),
  ])

  return mergeClientDuplicates(sameName, sameBizNo)
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
  // name·category는 빈 문자열이 올 수 없는 필수 값이라 null 변환에서 뺀다 (category의 타입이 string으로 넓어지지 않게).
  const { name, category, ...optional } = parsed.data
  const values = { name, category, ...nullifyEmptyStrings(optional) }

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
  // name·category는 빈 문자열이 올 수 없는 필수 값이라 null 변환에서 뺀다 (category의 타입이 string으로 넓어지지 않게).
  const { name, category, ...optional } = parsed.data
  const values = { name, category, ...nullifyEmptyStrings(optional) }

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

/** 매출 이력이 있으면 삭제 전 경고 표시용 건수 조회 (매출 폼에서 거래처로 연결한 건) */
export async function getClientSaleCount(id: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("sales")
    .select("id", { count: "exact", head: true })
    .eq("client_id", id)
    .is("deleted_at", null)

  if (error) {
    throw new Error(`매출 이력 조회 실패: ${error.message}`)
  }

  return count ?? 0
}

export async function deleteClientAction(id: string): Promise<void> {
  const supabase = await createClient()
  await softDelete(supabase, "clients", id)
  revalidatePath("/clients")
}
