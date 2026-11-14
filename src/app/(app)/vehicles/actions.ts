"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { recordAuditLog } from "@/lib/audit/log"
import { softDelete } from "@/lib/soft-delete/soft-delete"
import { createClient } from "@/lib/supabase/server"
import { MAX_PINNED_VEHICLES, movePinned, togglePinned } from "@/lib/vehicle-list"
import { toVehicleDbValues, vehicleFormSchema } from "@/lib/validations/vehicle"

const DUPLICATE_PLATE_MESSAGE = "이미 등록된 차량번호입니다"

export interface VehicleSearchResult {
  id: string
  plate_no: string
  driver_name: string
  driver_phone: string | null
}

/** 2.4 차량 자동완성: 차량번호/이름으로 검색 */
export async function searchVehiclesAction(
  query: string
): Promise<VehicleSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, plate_no, driver_name, driver_phone")
    .is("deleted_at", null)
    .or(`plate_no.ilike.%${trimmed}%,driver_name.ilike.%${trimmed}%`)
    .order("plate_no")
    .limit(20)

  if (error) {
    throw new Error(`차량 검색 실패: ${error.message}`)
  }

  return data
}

export interface VehicleActionState {
  error: string | null
}

export async function createVehicleAction(
  _prevState: VehicleActionState,
  formData: FormData
): Promise<VehicleActionState> {
  const parsed = vehicleFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" }
  }

  const supabase = await createClient()
  const values = toVehicleDbValues(parsed.data)

  const { data, error } = await supabase
    .from("vehicles")
    .insert(values)
    .select("id")
    .single()

  if (error) {
    return {
      error: error.code === "23505" ? DUPLICATE_PLATE_MESSAGE : `저장 실패: ${error.message}`,
    }
  }

  await recordAuditLog(supabase, {
    tableName: "vehicles",
    recordId: data.id,
    action: "CREATE",
    afterData: values,
  })

  revalidatePath("/vehicles")
  redirect("/vehicles")
}

export async function updateVehicleAction(
  id: string,
  _prevState: VehicleActionState,
  formData: FormData
): Promise<VehicleActionState> {
  const parsed = vehicleFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" }
  }

  const supabase = await createClient()
  const values = toVehicleDbValues(parsed.data)

  const { data: before, error: fetchError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchError || !before) {
    return { error: "대상 차량을 찾을 수 없습니다" }
  }

  const { error } = await supabase.from("vehicles").update(values).eq("id", id)

  if (error) {
    return {
      error: error.code === "23505" ? DUPLICATE_PLATE_MESSAGE : `저장 실패: ${error.message}`,
    }
  }

  await recordAuditLog(supabase, {
    tableName: "vehicles",
    recordId: id,
    action: "UPDATE",
    beforeData: before,
    afterData: { ...before, ...values },
  })

  revalidatePath("/vehicles")
  redirect("/vehicles")
}

/** 7.6: 배차 이력이 있으면 삭제 전 경고 표시용 건수 조회 */
export async function getVehicleDispatchCount(id: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("dispatches")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", id)
    .is("deleted_at", null)

  if (error) {
    throw new Error(`배차 이력 조회 실패: ${error.message}`)
  }

  return count ?? 0
}

export async function deleteVehicleAction(id: string): Promise<void> {
  const supabase = await createClient()
  await softDelete(supabase, "vehicles", id)
  revalidatePath("/vehicles")
}

/** 고정된 차량 id를 순서대로 */
async function getPinnedIds(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("id")
    .is("deleted_at", null)
    .not("pin_order", "is", null)
    .order("pin_order")
  if (error) throw new Error(`고정 목록 조회 실패: ${error.message}`)
  return data.map((row) => row.id)
}

/** 새 순서대로 pin_order를 1부터 다시 매기고, 빠진 차량은 고정을 푼다. */
async function savePinnedOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  before: string[],
  after: string[]
): Promise<void> {
  const removed = before.filter((id) => !after.includes(id))
  const updates = [
    ...removed.map((id) => supabase.from("vehicles").update({ pin_order: null }).eq("id", id)),
    ...after
      .map((id, index) => ({ id, order: index + 1 }))
      .filter(({ id, order }) => before.indexOf(id) + 1 !== order)
      .map(({ id, order }) => supabase.from("vehicles").update({ pin_order: order }).eq("id", id)),
  ]
  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)
  if (failed?.error) throw new Error(`고정 저장 실패: ${failed.error.message}`)
  revalidatePath("/vehicles")
}

/** 상단 고정 켜기·끄기 (최대 MAX_PINNED_VEHICLES대) */
export async function toggleVehiclePinAction(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const before = await getPinnedIds(supabase)
  const after = togglePinned(before, id)
  if (!after) return { error: `고정은 ${MAX_PINNED_VEHICLES}대까지예요. 하나를 풀고 다시 눌러 주세요.` }
  await savePinnedOrder(supabase, before, after)
  return { error: null }
}

/** 고정 순서 한 칸 위(-1)·아래(+1) */
export async function moveVehiclePinAction(id: string, delta: -1 | 1): Promise<void> {
  const supabase = await createClient()
  const before = await getPinnedIds(supabase)
  await savePinnedOrder(supabase, before, movePinned(before, id, delta))
}
