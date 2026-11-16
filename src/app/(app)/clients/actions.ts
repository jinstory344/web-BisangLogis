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
import { cleanContacts, clientFormSchema } from "@/lib/validations/client"
import { MAX_PINNED_VEHICLES, movePinned, togglePinned } from "@/lib/vehicle-list"

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

/** 거래처 고르기 상자에 처음부터 보여 줄 전체 목록 (고정한 거래처 먼저, 그다음 이름순) */
export async function listClientsAction(): Promise<ClientSearchResult[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, biz_no")
    .is("deleted_at", null)
    .order("pin_order", { ascending: true, nullsFirst: false })
    .order("name")
    .limit(500)

  if (error) {
    throw new Error(`거래처 목록 실패: ${error.message}`)
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

/** 폼은 담당자 목록을 JSON 글자로 보낸다 (FormData는 배열을 그대로 못 담아서) */
function parseClientForm(formData: FormData) {
  const raw = Object.fromEntries(formData)
  let contacts: unknown = []
  try {
    contacts = JSON.parse(String(raw.contacts ?? "[]"))
  } catch {
    contacts = []
  }
  return clientFormSchema.safeParse({ ...raw, contacts })
}

/** 거래처 담당자 목록을 통째로 바꾼다: 예전 줄은 지운 표시(deleted_at), 새 목록을 순서대로 넣는다. */
async function saveClientContacts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  contacts: { name: string; phone: string | null }[]
): Promise<string | null> {
  const removed = await supabase
    .from("client_contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .is("deleted_at", null)
  if (removed.error) return `담당자 저장 실패: ${removed.error.message}`
  if (contacts.length === 0) return null
  const inserted = await supabase
    .from("client_contacts")
    .insert(contacts.map((c, i) => ({ client_id: clientId, name: c.name, phone: c.phone, sort_order: i })))
  return inserted.error ? `담당자 저장 실패: ${inserted.error.message}` : null
}

/** 거래처 판·검색 카드용 담당자 목록 (거래처별, 순서대로) */
export async function getClientContacts(
  clientIds: string[]
): Promise<Record<string, { name: string; phone: string | null }[]>> {
  if (clientIds.length === 0) return {}
  const supabase = await createClient()
  const { data } = await supabase
    .from("client_contacts")
    .select("client_id, name, phone, sort_order")
    .in("client_id", clientIds)
    .is("deleted_at", null)
    .order("sort_order")
  const map: Record<string, { name: string; phone: string | null }[]> = {}
  for (const row of data ?? []) (map[row.client_id] ??= []).push({ name: row.name, phone: row.phone })
  return map
}

export interface ClientActionState {
  error: string | null
}

export async function createClientAction(
  _prevState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  const parsed = parseClientForm(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" }
  }

  const supabase = await createClient()
  // name·category는 빈 문자열이 올 수 없는 필수 값이라 null 변환에서 뺀다 (category의 타입이 string으로 넓어지지 않게).
  const { name, category, contacts: rawContacts, ...optional } = parsed.data
  const contacts = cleanContacts(rawContacts)
  // 첫 번째 담당자는 거래처 칸에도 적어 둔다(예전 화면·매출 거래처 고르기 등이 그대로 쓰도록)
  const values = {
    name,
    category,
    ...nullifyEmptyStrings(optional),
    contact_name: contacts[0]?.name ?? null,
    contact_phone: contacts[0]?.phone ?? null,
  }

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

  const contactError = await saveClientContacts(supabase, data.id, contacts)
  if (contactError) return { error: contactError }

  revalidatePath("/clients")
  redirect("/clients")
}

export async function updateClientAction(
  id: string,
  _prevState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  const parsed = parseClientForm(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" }
  }

  const supabase = await createClient()
  // name·category는 빈 문자열이 올 수 없는 필수 값이라 null 변환에서 뺀다 (category의 타입이 string으로 넓어지지 않게).
  const { name, category, contacts: rawContacts, ...optional } = parsed.data
  const contacts = cleanContacts(rawContacts)
  // 첫 번째 담당자는 거래처 칸에도 적어 둔다(예전 화면·매출 거래처 고르기 등이 그대로 쓰도록)
  const values = {
    name,
    category,
    ...nullifyEmptyStrings(optional),
    contact_name: contacts[0]?.name ?? null,
    contact_phone: contacts[0]?.phone ?? null,
  }

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

  const contactError = await saveClientContacts(supabase, id, contacts)
  if (contactError) return { error: contactError }

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

/** 고정된 거래처 id를 순서대로 */
async function getPinnedClientIds(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .is("deleted_at", null)
    .not("pin_order", "is", null)
    .order("pin_order")
  if (error) throw new Error(`고정 목록 조회 실패: ${error.message}`)
  return data.map((row) => row.id)
}

/** 새 순서대로 pin_order를 1부터 다시 매기고, 빠진 거래처는 고정을 푼다 (차량 정보 고정과 같은 방식). */
async function saveClientPinOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  before: string[],
  after: string[]
): Promise<void> {
  const updates = [
    ...before
      .filter((id) => !after.includes(id))
      .map((id) => supabase.from("clients").update({ pin_order: null }).eq("id", id)),
    ...after
      .map((id, index) => ({ id, order: index + 1 }))
      .filter(({ id, order }) => before.indexOf(id) + 1 !== order)
      .map(({ id, order }) => supabase.from("clients").update({ pin_order: order }).eq("id", id)),
  ]
  const failed = (await Promise.all(updates)).find((r) => r.error)
  if (failed?.error) throw new Error(`고정 저장 실패: ${failed.error.message}`)
  revalidatePath("/clients")
}

/** 거래처 상단 고정 켜기·끄기 (최대 10곳) */
export async function toggleClientPinAction(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const before = await getPinnedClientIds(supabase)
  const after = togglePinned(before, id)
  if (!after) return { error: `고정은 ${MAX_PINNED_VEHICLES}곳까지예요. 하나를 풀고 다시 눌러 주세요.` }
  await saveClientPinOrder(supabase, before, after)
  return { error: null }
}

/** 거래처 고정 순서 한 칸 위(-1)·아래(+1) */
export async function moveClientPinAction(id: string, delta: -1 | 1): Promise<void> {
  const supabase = await createClient()
  const before = await getPinnedClientIds(supabase)
  await saveClientPinOrder(supabase, before, movePinned(before, id, delta))
}
