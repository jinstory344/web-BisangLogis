"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { recordAuditLog } from "@/lib/audit/log"
import {
  pickRecentContacts,
  pickRecentRoutes,
  RECENT_CONTACT_LIMIT,
  RECENT_CONTACT_SCAN_SIZE,
  RECENT_ROUTE_LIMIT,
  RECENT_ROUTE_SCAN_SIZE,
  type RecentRoute,
} from "@/lib/quick-entry"
import { cancelPaidPatch, markPaidPatch } from "@/lib/sales-payment"
import { softDelete } from "@/lib/soft-delete/soft-delete"
import { createClient } from "@/lib/supabase/server"
import {
  coerceSaleFormData,
  resolveSaleClientId,
  saleFormSchema,
} from "@/lib/validations/sales"

/**
 * 매출 전용 서버 액션. 배차(dispatches)와는 완전히 독립된 테이블이므로
 * dispatches/actions.ts를 import하지 않는다 — 한쪽 필드 구성이 바뀌어도
 * 다른 쪽에 영향이 없어야 한다.
 */

/** 7.3 상차지 최근 입력값 자동완성 (sales 기준) */
export async function searchOriginSuggestionsAction(
  query: string
): Promise<string[]> {
  const trimmed = query.trim()
  const supabase = await createClient()
  let request = supabase
    .from("sales")
    .select("origin")
    .is("deleted_at", null)
    .order("sale_date", { ascending: false })
    .limit(50)

  if (trimmed) {
    request = request.ilike("origin", `%${trimmed}%`)
  }

  const { data, error } = await request
  if (error) {
    throw new Error(`최근 입력값 조회 실패: ${error.message}`)
  }

  return Array.from(new Set(data.map((row) => row.origin))).slice(0, 10)
}

/** 7.3 하차지 최근 입력값 자동완성 (sales 기준) */
export async function searchDestinationSuggestionsAction(
  query: string
): Promise<string[]> {
  const trimmed = query.trim()
  const supabase = await createClient()
  let request = supabase
    .from("sales")
    .select("destination")
    .is("deleted_at", null)
    .order("sale_date", { ascending: false })
    .limit(50)

  if (trimmed) {
    request = request.ilike("destination", `%${trimmed}%`)
  }

  const { data, error } = await request
  if (error) {
    throw new Error(`최근 입력값 조회 실패: ${error.message}`)
  }

  return Array.from(new Set(data.map((row) => row.destination))).slice(0, 10)
}

/** 계산서정보 최근 입력값 자동완성 (sales 기준) */
export async function searchBillingEntityNameSuggestionsAction(
  query: string
): Promise<string[]> {
  const trimmed = query.trim()
  const supabase = await createClient()
  let request = supabase
    .from("sales")
    .select("billing_entity_name")
    .is("deleted_at", null)
    .not("billing_entity_name", "is", null)
    .order("sale_date", { ascending: false })
    .limit(50)

  if (trimmed) {
    request = request.ilike("billing_entity_name", `%${trimmed}%`)
  }

  const { data, error } = await request
  if (error) {
    throw new Error(`최근 입력값 조회 실패: ${error.message}`)
  }

  return Array.from(
    new Set(
      data
        .map((row) => row.billing_entity_name)
        .filter((v): v is string => !!v)
    )
  ).slice(0, 10)
}

/**
 * 새 등록·복사 등록 화면의 "최근 구간" 칩: 최근 등록한(created_at 최신순) 매출에서
 * 서로 다른 상차지 → 하차지 조합을 최대 5개 돌려준다. 삭제된 건은 제외한다.
 */
export async function getRecentSaleRoutesAction(): Promise<RecentRoute[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sales")
    .select("origin, destination")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(RECENT_ROUTE_SCAN_SIZE)

  if (error) {
    throw new Error(`최근 구간 조회 실패: ${error.message}`)
  }

  return pickRecentRoutes(data, RECENT_ROUTE_LIMIT)
}

/**
 * 매출 폼 "최근 연락처" 칩: 같은 출처(대분류+소분류)로 등록한 최근 매출에서
 * 서로 다른 연락처를 최대 5개 돌려준다. 삭제된 건은 제외하고, 소분류가 비어 있으면 빈 목록이다.
 * 대분류가 비어 있으면 대분류 없이 저장된 건끼리만 맞춘다.
 * 같은 거래처라도 건마다 담당자가 달라서, 연락처를 자동으로 채우지 않고 칩으로만 제안한다.
 */
export async function getRecentSaleContactsAction(input: {
  sourceMajor: string
  sourceMinor: string
}): Promise<string[]> {
  const sourceMinor = input.sourceMinor.trim()
  if (!sourceMinor) return []

  const sourceMajor = input.sourceMajor.trim()
  const supabase = await createClient()
  let request = supabase
    .from("sales")
    .select("order_contact_phone")
    .is("deleted_at", null)
    .not("order_contact_phone", "is", null)
    .eq("source_minor", sourceMinor)
    .order("created_at", { ascending: false })
    .limit(RECENT_CONTACT_SCAN_SIZE)

  request = sourceMajor
    ? request.eq("source_major", sourceMajor)
    : request.is("source_major", null)

  const { data, error } = await request
  if (error) {
    throw new Error(`최근 연락처 조회 실패: ${error.message}`)
  }

  return pickRecentContacts(data, RECENT_CONTACT_LIMIT)
}

/** 4.3.6 중복 입력 감지: 매출일자+상차지+하차지+공급가액 동일 건 존재 여부 */
export async function checkDuplicateSaleAction(input: {
  saleDate: string
  origin: string
  destination: string
  supplyAmount: number
}): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("sales")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("sale_date", input.saleDate)
    .eq("origin", input.origin)
    .eq("destination", input.destination)
    .eq("supply_amount", input.supplyAmount)

  if (error) {
    throw new Error(`중복 확인 실패: ${error.message}`)
  }

  return (count ?? 0) > 0
}

export interface SaleActionState {
  error: string | null
}

/** 3.1~3.3 매출 등록. 부가세/합계는 create_sale RPC가 공급가액으로부터 계산한다. */
export async function createSaleAction(
  _prevState: SaleActionState,
  formData: FormData
): Promise<SaleActionState> {
  const parsed = saleFormSchema.safeParse(
    coerceSaleFormData(Object.fromEntries(formData))
  )
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" }
  }

  const values = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.rpc("create_sale", {
    p_sale_date: values.sale_date,
    p_origin: values.origin,
    p_destination: values.destination,
    p_supply_amount: values.supply_amount,
    p_is_vat_exempt: values.is_vat_exempt,
    p_payment_method: values.payment_method,
    // 미선택("")은 DB가 빈 문자열을 허용하지 않으므로 null로 정규화한다.
    p_source_major: values.source_major || null,
    p_source_minor: values.source_minor || null,
    p_source_note: values.source_note || null,
    p_memo: values.memo || null,
    p_billing_entity_name: values.billing_entity_name || null,
    p_order_contact_phone: values.order_contact_phone || null,
    p_client_id: resolveSaleClientId(values),
  })

  if (error) {
    return { error: `저장 실패: ${error.message}` }
  }

  revalidatePath("/sales")
  revalidatePath("/")
  // 등록이 끝나면 장부(홈)로 돌아간다.
  redirect("/")
}

/** 3.7 매출 수정 (update_sale RPC가 부가세 재계산 + 감사 로그를 함께 처리) */
export async function updateSaleAction(
  id: string,
  _prevState: SaleActionState,
  formData: FormData
): Promise<SaleActionState> {
  const parsed = saleFormSchema.safeParse(
    coerceSaleFormData(Object.fromEntries(formData))
  )
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" }
  }

  const values = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.rpc("update_sale", {
    p_id: id,
    p_sale_date: values.sale_date,
    p_origin: values.origin,
    p_destination: values.destination,
    p_supply_amount: values.supply_amount,
    p_is_vat_exempt: values.is_vat_exempt,
    p_payment_method: values.payment_method,
    p_source_major: values.source_major || null,
    p_source_minor: values.source_minor || null,
    p_source_note: values.source_note || null,
    p_memo: values.memo || null,
    p_billing_entity_name: values.billing_entity_name || null,
    p_order_contact_phone: values.order_contact_phone || null,
    p_client_id: resolveSaleClientId(values),
  })

  if (error) {
    return { error: `저장 실패: ${error.message}` }
  }

  revalidatePath("/sales")
  // 비상(홈) 화면의 합계·목록·미입금도 바로 바뀌게
  revalidatePath("/")
  revalidatePath(`/sales/${id}`)
  redirect(`/sales/${id}`)
}

/** 3.7 매출 삭제 (소프트 삭제 + 이력 로그) */
export async function deleteSaleAction(id: string): Promise<void> {
  const supabase = await createClient()
  await softDelete(supabase, "sales", id)
  revalidatePath("/sales")
  // 비상(홈) 화면의 합계·목록·미입금도 바로 바뀌게
  revalidatePath("/")
}

/** 매출 목록에서 체크박스로 선택한 여러 건을 한 번에 삭제 */
export async function bulkDeleteSalesAction(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  await Promise.all(ids.map((id) => deleteSaleAction(id)))
}

/** 3.6 입금 처리 (개별): 입금완료로 변경하고 입금일을 기록한다 */
export async function markSalePaidAction(
  id: string,
  paidAt: string
): Promise<void> {
  const supabase = await createClient()

  const { data: before, error: fetchError } = await supabase
    .from("sales")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchError || !before) {
    throw new Error("대상 매출을 찾을 수 없습니다")
  }

  const { error } = await supabase
    .from("sales")
    .update(markPaidPatch(paidAt))
    .eq("id", id)

  if (error) {
    throw new Error(`입금 처리 실패: ${error.message}`)
  }

  await recordAuditLog(supabase, {
    tableName: "sales",
    recordId: id,
    action: "UPDATE",
    beforeData: before,
    afterData: { ...before, ...markPaidPatch(paidAt) },
  })

  revalidatePath("/sales")
  // 비상(홈) 화면의 합계·목록·미입금도 바로 바뀌게
  revalidatePath("/")
  revalidatePath(`/sales/${id}`)
}

/** 입금 취소: 실수로 입금 처리했을 때 미입금으로 되돌리고 입금일을 지운다 */
export async function cancelSalePaidAction(id: string): Promise<void> {
  const supabase = await createClient()

  const { data: before, error: fetchError } = await supabase
    .from("sales")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single()

  if (fetchError || !before) {
    throw new Error("대상 매출을 찾을 수 없습니다")
  }
  if (before.payment_status !== "PAID") {
    throw new Error("입금완료 상태가 아니라서 취소할 수 없습니다")
  }

  const { error } = await supabase
    .from("sales")
    .update(cancelPaidPatch())
    .eq("id", id)

  if (error) {
    throw new Error(`입금 취소 실패: ${error.message}`)
  }

  await recordAuditLog(supabase, {
    tableName: "sales",
    recordId: id,
    action: "UPDATE",
    beforeData: before,
    afterData: { ...before, ...cancelPaidPatch() },
  })

  revalidatePath("/sales")
  // 비상(홈) 화면의 합계·목록·미입금도 바로 바뀌게
  revalidatePath("/")
  revalidatePath(`/sales/${id}`)
}

/** 3.6 입금 처리 (일괄): 체크박스로 선택한 여러 건을 한 번에 입금완료 처리 */
export async function bulkMarkSalesPaidAction(
  ids: string[],
  paidAt: string
): Promise<void> {
  if (ids.length === 0) return

  await Promise.all(ids.map((id) => markSalePaidAction(id, paidAt)))
}
