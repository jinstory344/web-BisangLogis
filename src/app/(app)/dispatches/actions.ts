"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { recordAuditLog } from "@/lib/audit/log"
import { softDelete } from "@/lib/soft-delete/soft-delete"
import { createClient } from "@/lib/supabase/server"
import {
  coerceDispatchFormData,
  dispatchFormSchema,
} from "@/lib/validations/dispatch"

/** 7.3 상차지 최근 입력값 자동완성 */
export async function searchOriginSuggestionsAction(
  query: string
): Promise<string[]> {
  const trimmed = query.trim()
  const supabase = await createClient()
  let request = supabase
    .from("dispatches")
    .select("origin")
    .is("deleted_at", null)
    .order("dispatch_date", { ascending: false })
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

/** 7.3 하차지 최근 입력값 자동완성 */
export async function searchDestinationSuggestionsAction(
  query: string
): Promise<string[]> {
  const trimmed = query.trim()
  const supabase = await createClient()
  let request = supabase
    .from("dispatches")
    .select("destination")
    .is("deleted_at", null)
    .order("dispatch_date", { ascending: false })
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

/** 4.3.6 중복 입력 감지: 운송일자+거래처+상차지+하차지+차량번호+합계운임 동일 건 존재 여부 */
export async function checkDuplicateDispatchAction(input: {
  dispatchDate: string
  clientId: string
  origin: string
  destination: string
  plateNoSnapshot: string
  totalAmount: number
}): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("dispatches")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("dispatch_date", input.dispatchDate)
    .eq("client_id", input.clientId)
    .eq("origin", input.origin)
    .eq("destination", input.destination)
    .eq("plate_no_snapshot", input.plateNoSnapshot)
    .eq("total_amount", input.totalAmount)

  if (error) {
    throw new Error(`중복 확인 실패: ${error.message}`)
  }

  return (count ?? 0) > 0
}

export interface DispatchActionState {
  error: string | null
}

/** 3.1~3.3, 4.3.9: 배차 등록 → 매출 자동 생성을 하나의 트랜잭션(RPC)으로 처리 */
export async function createDispatchAction(
  _prevState: DispatchActionState,
  formData: FormData
): Promise<DispatchActionState> {
  const parsed = dispatchFormSchema.safeParse(
    coerceDispatchFormData(Object.fromEntries(formData))
  )
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" }
  }

  const values = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.rpc("create_dispatch", {
    p_dispatch_date: values.dispatch_date,
    p_client_id: values.client_id,
    p_origin: values.origin,
    p_destination: values.destination,
    p_pallet_count: values.pallet_count ?? null,
    p_vehicle_id: values.vehicle_id || null,
    p_plate_no_snapshot: values.plate_no_snapshot || null,
    p_driver_name_snapshot: values.driver_name_snapshot || null,
    p_driver_phone_snapshot: values.driver_phone_snapshot || null,
    p_carrier_name: values.carrier_name || null,
    p_dispatcher_name: values.dispatcher_name || null,
    p_total_amount: values.total_amount,
    p_is_vat_exempt: values.is_vat_exempt,
    p_fee_amount: values.fee_amount,
    p_payment_method: values.payment_method,
    p_memo: values.memo || null,
  })

  if (error) {
    return { error: `저장 실패: ${error.message}` }
  }

  revalidatePath("/dispatches")
  redirect("/dispatches")
}

/** 3.6 입금 처리 (개별): 입금완료로 변경하고 입금일을 기록한다 */
export async function markDispatchPaidAction(
  id: string,
  paidAt: string
): Promise<void> {
  const supabase = await createClient()

  const { data: before, error: fetchError } = await supabase
    .from("dispatches")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchError || !before) {
    throw new Error("대상 배차를 찾을 수 없습니다")
  }

  const { error } = await supabase
    .from("dispatches")
    .update({ payment_status: "PAID", paid_at: paidAt })
    .eq("id", id)

  if (error) {
    throw new Error(`입금 처리 실패: ${error.message}`)
  }

  await recordAuditLog(supabase, {
    tableName: "dispatches",
    recordId: id,
    action: "UPDATE",
    beforeData: before,
    afterData: { ...before, payment_status: "PAID", paid_at: paidAt },
  })

  revalidatePath("/dispatches")
}

/** 3.6 입금 처리 (일괄): 체크박스로 선택한 여러 건을 한 번에 입금완료 처리 */
export async function bulkMarkDispatchesPaidAction(
  ids: string[],
  paidAt: string
): Promise<void> {
  if (ids.length === 0) return

  await Promise.all(ids.map((id) => markDispatchPaidAction(id, paidAt)))
}

/** 3.7 배차 삭제 (소프트 삭제 + 이력 로그) */
export async function deleteDispatchAction(id: string): Promise<void> {
  const supabase = await createClient()
  await softDelete(supabase, "dispatches", id)
  revalidatePath("/dispatches")
}

/** 3.7 배차 수정 (update_dispatch RPC로 부가세 재계산 + 감사 로그를 함께 처리) */
export async function updateDispatchAction(
  id: string,
  _prevState: DispatchActionState,
  formData: FormData
): Promise<DispatchActionState> {
  const parsed = dispatchFormSchema.safeParse(
    coerceDispatchFormData(Object.fromEntries(formData))
  )
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" }
  }

  const values = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.rpc("update_dispatch", {
    p_id: id,
    p_dispatch_date: values.dispatch_date,
    p_client_id: values.client_id,
    p_origin: values.origin,
    p_destination: values.destination,
    p_pallet_count: values.pallet_count ?? null,
    p_vehicle_id: values.vehicle_id || null,
    p_plate_no_snapshot: values.plate_no_snapshot || null,
    p_driver_name_snapshot: values.driver_name_snapshot || null,
    p_driver_phone_snapshot: values.driver_phone_snapshot || null,
    p_carrier_name: values.carrier_name || null,
    p_dispatcher_name: values.dispatcher_name || null,
    p_total_amount: values.total_amount,
    p_is_vat_exempt: values.is_vat_exempt,
    p_fee_amount: values.fee_amount,
    p_payment_method: values.payment_method,
    p_memo: values.memo || null,
  })

  if (error) {
    return { error: `저장 실패: ${error.message}` }
  }

  revalidatePath("/dispatches")
  revalidatePath(`/dispatches/${id}`)
  redirect(`/dispatches/${id}`)
}
