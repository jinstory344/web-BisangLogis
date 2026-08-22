"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { recordAuditLog } from "@/lib/audit/log"
import { softDelete } from "@/lib/soft-delete/soft-delete"
import { createClient } from "@/lib/supabase/server"
import { coerceSaleFormData, saleFormSchema } from "@/lib/validations/sales"

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

/** 사업자정보(운수사) 최근 입력값 자동완성 (sales 기준) */
export async function searchCarrierNameSuggestionsAction(
  query: string
): Promise<string[]> {
  const trimmed = query.trim()
  const supabase = await createClient()
  let request = supabase
    .from("sales")
    .select("carrier_name")
    .is("deleted_at", null)
    .not("carrier_name", "is", null)
    .order("sale_date", { ascending: false })
    .limit(50)

  if (trimmed) {
    request = request.ilike("carrier_name", `%${trimmed}%`)
  }

  const { data, error } = await request
  if (error) {
    throw new Error(`최근 입력값 조회 실패: ${error.message}`)
  }

  return Array.from(
    new Set(data.map((row) => row.carrier_name).filter((v): v is string => !!v))
  ).slice(0, 10)
}

/** 계산서발행할사업자 최근 입력값 자동완성 (sales 기준) */
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
    p_carrier_name: values.carrier_name || null,
    p_memo: values.memo || null,
    p_billing_entity_name: values.billing_entity_name || null,
    p_order_contact_phone: values.order_contact_phone || null,
  })

  if (error) {
    return { error: `저장 실패: ${error.message}` }
  }

  revalidatePath("/sales")
  redirect("/sales")
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
    p_carrier_name: values.carrier_name || null,
    p_memo: values.memo || null,
    p_billing_entity_name: values.billing_entity_name || null,
    p_order_contact_phone: values.order_contact_phone || null,
  })

  if (error) {
    return { error: `저장 실패: ${error.message}` }
  }

  revalidatePath("/sales")
  revalidatePath(`/sales/${id}`)
  redirect(`/sales/${id}`)
}

/** 3.7 매출 삭제 (소프트 삭제 + 이력 로그) */
export async function deleteSaleAction(id: string): Promise<void> {
  const supabase = await createClient()
  await softDelete(supabase, "sales", id)
  revalidatePath("/sales")
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
    .update({ payment_status: "PAID", paid_at: paidAt })
    .eq("id", id)

  if (error) {
    throw new Error(`입금 처리 실패: ${error.message}`)
  }

  await recordAuditLog(supabase, {
    tableName: "sales",
    recordId: id,
    action: "UPDATE",
    beforeData: before,
    afterData: { ...before, payment_status: "PAID", paid_at: paidAt },
  })

  revalidatePath("/sales")
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
