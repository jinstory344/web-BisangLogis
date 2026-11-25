"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { recordAuditLog } from "@/lib/audit/log"
import { isLiterKind, isProtectedLogKind, MAX_KM, parseKm, SERVICE_KIND } from "@/lib/car-ledger/constants"
import { loadServiceItems, replaceServiceItems } from "@/lib/car-ledger/service-items-db"
import { parseLiters } from "@/lib/fuel"
import { safeReturnPath } from "@/lib/return-to"
import { softDelete } from "@/lib/soft-delete/soft-delete"
import type { CarItemKind, CarKind } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { carLogFormSchema, coerceCarLogFormData, type CarLogFormValues } from "@/lib/validations/car-log"

export interface CarLogActionState {
  error: string | null
}

export type CarActionResult = { ok: true } | { ok: false; error: string }

const fail = (error: string): CarActionResult => ({ ok: false, error })

function refresh() {
  revalidatePath("/car-ledger", "layout")
}

// ─────────────────────────────────────────────
// 차계부 기록 (car_logs)
// ─────────────────────────────────────────────

function toCarLogValues(values: CarLogFormValues) {
  const isService = values.kind === SERVICE_KIND
  return {
    row: {
      car_id: values.car_id,
      log_date: values.log_date,
      kind: values.kind.trim(),
      amount: values.amount,
      // 리터는 주유·요소수 종류일 때만
      liters: isLiterKind(values.kind) ? parseLiters(values.liters) : null,
      odometer_km: parseKm(values.odometer_km),
      vendor: values.vendor || null,
      memo: values.memo || null,
    },
    serviceItems: isService
      ? values.service_items.map((line) => ({ item: line.item.trim(), amount: line.amount }))
      : [],
  }
}

function parseCarLog(formData: FormData) {
  return carLogFormSchema.safeParse(coerceCarLogFormData(Object.fromEntries(formData)))
}

const ITEMS_FAILED = "기록은 저장했지만 정비 항목을 저장하지 못했어요. 다시 열어 저장해 주세요"

export async function createCarLogAction(
  returnTo: string | null,
  _prev: CarLogActionState,
  formData: FormData
): Promise<CarLogActionState> {
  const parsed = parseCarLog(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" }

  const supabase = await createClient()
  const { row, serviceItems } = toCarLogValues(parsed.data)
  const { data, error } = await supabase.from("car_logs").insert(row).select("*").single()
  if (error || !data) return { error: `저장 실패: ${error?.message ?? "알 수 없는 오류"}` }

  const itemsError = serviceItems.length > 0 ? await replaceServiceItems(supabase, { carLogId: data.id }, serviceItems) : null
  await recordAuditLog(supabase, {
    tableName: "car_logs",
    recordId: data.id,
    action: "CREATE",
    afterData: serviceItems.length > 0 && !itemsError ? { ...data, car_service_items: serviceItems } : data,
  })

  refresh()
  if (itemsError) return { error: `${ITEMS_FAILED} (${itemsError})` }
  redirect(safeReturnPath(returnTo) ?? `/car-ledger?car=${row.car_id}`)
}

export async function updateCarLogAction(
  id: string,
  returnTo: string | null,
  _prev: CarLogActionState,
  formData: FormData
): Promise<CarLogActionState> {
  const parsed = parseCarLog(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" }

  const supabase = await createClient()
  const { data: before } = await supabase.from("car_logs").select("*").eq("id", id).is("deleted_at", null).maybeSingle()
  if (!before) return { error: "기록을 찾을 수 없어요 (지워졌을 수 있어요)" }

  const { row, serviceItems } = toCarLogValues(parsed.data)
  const { error } = await supabase.from("car_logs").update(row).eq("id", id)
  if (error) return { error: `저장 실패: ${error.message}` }

  const beforeItems = await loadServiceItems(supabase, { carLogId: id })
  const itemsError = await replaceServiceItems(supabase, { carLogId: id }, serviceItems)
  await recordAuditLog(supabase, {
    tableName: "car_logs",
    recordId: id,
    action: "UPDATE",
    beforeData: { ...before, car_service_items: beforeItems },
    afterData: { ...before, ...row, car_service_items: itemsError ? beforeItems : serviceItems },
  })

  refresh()
  if (itemsError) return { error: `${ITEMS_FAILED} (${itemsError})` }
  redirect(safeReturnPath(returnTo) ?? `/car-ledger?car=${row.car_id}`)
}

/** 차계부 기록 삭제 → 휴지통 (정비 항목 줄은 남겨 두었다가 되살리면 함께 돌아온다) */
export async function deleteCarLogAction(id: string): Promise<CarActionResult> {
  const supabase = await createClient()
  try {
    await softDelete(supabase, "car_logs", id)
  } catch (error) {
    return fail(error instanceof Error ? error.message : "삭제하지 못했어요")
  }
  refresh()
  revalidatePath("/trash")
  return { ok: true }
}

// ─────────────────────────────────────────────
// 교체 주기 표 (car_item_cycles)
// ─────────────────────────────────────────────

async function loadCycle(id: string) {
  const supabase = await createClient()
  const { data } = await supabase.from("car_item_cycles").select("*").eq("id", id).is("deleted_at", null).maybeSingle()
  return { supabase, before: data }
}

/** 주기(km) 바로 입력. 빈칸이면 주기 지우기 */
export async function setCycleKmAction(id: string, raw: string): Promise<CarActionResult> {
  if (typeof raw !== "string") return fail("입력값이 올바르지 않아요")
  const cycleKm = parseKm(raw)
  if (Number.isNaN(cycleKm) || cycleKm === 0) return fail("주기는 1 이상 숫자로 입력하세요 (예: 15,000)")

  const { supabase, before } = await loadCycle(id)
  if (!before) return fail("항목을 찾을 수 없어요")
  if (before.cycle_km === cycleKm) return { ok: true }
  const { error } = await supabase.from("car_item_cycles").update({ cycle_km: cycleKm }).eq("id", id)
  if (error) return fail(`저장 실패: ${error.message}`)
  await recordAuditLog(supabase, {
    tableName: "car_item_cycles",
    recordId: id,
    action: "UPDATE",
    beforeData: before,
    afterData: { ...before, cycle_km: cycleKm },
  })
  refresh()
  return { ok: true }
}

/** 최근 교체일·km 직접 고치기. 둘 다 비우면 "기록에서 자동"으로 돌아간다 */
export async function setCycleManualAction(
  id: string,
  rawDate: string,
  rawKm: string
): Promise<CarActionResult> {
  if (typeof rawDate !== "string" || typeof rawKm !== "string") return fail("입력값이 올바르지 않아요")
  const manualDate = rawDate.trim() === "" ? null : rawDate.trim()
  if (manualDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(manualDate)) return fail("날짜가 올바르지 않아요")
  const manualKm = parseKm(rawKm)
  if (Number.isNaN(manualKm)) return fail(`km는 0~${MAX_KM.toLocaleString("ko-KR")} 숫자로 입력하세요`)

  const { supabase, before } = await loadCycle(id)
  if (!before) return fail("항목을 찾을 수 없어요")
  const patch = { manual_date: manualDate, manual_km: manualKm }
  const { error } = await supabase.from("car_item_cycles").update(patch).eq("id", id)
  if (error) return fail(`저장 실패: ${error.message}`)
  await recordAuditLog(supabase, {
    tableName: "car_item_cycles",
    recordId: id,
    action: "UPDATE",
    beforeData: before,
    afterData: { ...before, ...patch },
  })
  refresh()
  return { ok: true }
}

/** 교체 주기 표에 항목 추가 (정비 항목 중에서) */
export async function addCycleItemAction(carId: string, item: string): Promise<CarActionResult> {
  if (typeof carId !== "string" || typeof item !== "string" || !item.trim()) return fail("항목을 고르세요")
  const name = item.trim()
  const supabase = await createClient()
  const { data: rows, error: readError } = await supabase
    .from("car_item_cycles")
    .select("item, sort_order")
    .eq("car_id", carId)
    .is("deleted_at", null)
  if (readError) return fail(`저장 실패: ${readError.message}`)
  if ((rows ?? []).some((row) => row.item === name)) return fail("이미 표에 있는 항목이에요")
  const sortOrder = Math.max(-10, ...(rows ?? []).map((row) => row.sort_order)) + 10
  const { data, error } = await supabase
    .from("car_item_cycles")
    .insert({ car_id: carId, item: name, sort_order: sortOrder })
    .select("*")
    .single()
  if (error || !data) return fail(error?.code === "23505" ? "이미 표에 있는 항목이에요" : `저장 실패: ${error?.message}`)
  await recordAuditLog(supabase, { tableName: "car_item_cycles", recordId: data.id, action: "CREATE", afterData: data })
  refresh()
  return { ok: true }
}

/** 교체 주기 표에서 행 빼기 (소프트 삭제, 정비 기록은 그대로) */
export async function deleteCycleAction(id: string): Promise<CarActionResult> {
  const { supabase, before } = await loadCycle(id)
  if (!before) return fail("항목을 찾을 수 없어요")
  const { error } = await supabase
    .from("car_item_cycles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return fail(`삭제 실패: ${error.message}`)
  await recordAuditLog(supabase, { tableName: "car_item_cycles", recordId: id, action: "DELETE", beforeData: before })
  refresh()
  return { ok: true }
}

// ─────────────────────────────────────────────
// 설정: 차 (cars)
// ─────────────────────────────────────────────

function checkCarText(name: string, plate: string): string | null {
  if (name.trim().length < 1 || name.trim().length > 20) return "차 이름은 1~20자로 입력하세요"
  if (plate.trim().length > 20) return "번호판은 20자 이하로 입력하세요"
  return null
}

export async function addCarAction(input: { name: string; plateNo: string; kind: CarKind }): Promise<CarActionResult> {
  const { name, plateNo, kind } = input ?? {}
  if (typeof name !== "string" || typeof plateNo !== "string") return fail("입력값이 올바르지 않아요")
  if (kind !== "business" && kind !== "personal") return fail("업무용·개인 중에서 고르세요")
  const message = checkCarText(name, plateNo)
  if (message) return fail(message)

  const supabase = await createClient()
  const { data: last } = await supabase
    .from("cars")
    .select("sort_order")
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)
  const { data, error } = await supabase
    .from("cars")
    .insert({ name: name.trim(), plate_no: plateNo.trim() || null, kind, sort_order: (last?.[0]?.sort_order ?? 0) + 10 })
    .select("*")
    .single()
  if (error || !data) return fail(`저장 실패: ${error?.message}`)
  await recordAuditLog(supabase, { tableName: "cars", recordId: data.id, action: "CREATE", afterData: data })
  refresh()
  return { ok: true }
}

export async function updateCarAction(id: string, input: { name: string; plateNo: string }): Promise<CarActionResult> {
  const { name, plateNo } = input ?? {}
  if (typeof id !== "string" || typeof name !== "string" || typeof plateNo !== "string") {
    return fail("입력값이 올바르지 않아요")
  }
  const message = checkCarText(name, plateNo)
  if (message) return fail(message)

  const supabase = await createClient()
  const { data: before } = await supabase.from("cars").select("*").eq("id", id).is("deleted_at", null).maybeSingle()
  if (!before) return fail("차를 찾을 수 없어요")
  const patch = { name: name.trim(), plate_no: plateNo.trim() || null }
  const { error } = await supabase.from("cars").update(patch).eq("id", id)
  if (error) return fail(`저장 실패: ${error.message}`)
  await recordAuditLog(supabase, {
    tableName: "cars",
    recordId: id,
    action: "UPDATE",
    beforeData: before,
    afterData: { ...before, ...patch },
  })
  refresh()
  return { ok: true }
}

/**
 * 차 삭제. 그 차의 차계부 기록이 남아 있거나, 지출(정비·주유비·요소수)이 이어지는 첫 업무용 차면 막는다
 * (지우면 지출이 다른 차로 넘어가 보이기 때문).
 */
export async function deleteCarAction(id: string): Promise<CarActionResult> {
  if (typeof id !== "string") return fail("입력값이 올바르지 않아요")
  const supabase = await createClient()
  const { data: cars } = await supabase.from("cars").select("*").is("deleted_at", null).order("sort_order").order("created_at")
  const before = (cars ?? []).find((car) => car.id === id)
  if (!before) return fail("차를 찾을 수 없어요")

  const { count } = await supabase
    .from("car_logs")
    .select("id", { count: "exact", head: true })
    .eq("car_id", id)
    .is("deleted_at", null)
  if ((count ?? 0) > 0) return fail(`이 차의 차계부 기록 ${count}건이 있어 지울 수 없어요. 기록을 먼저 지우세요`)

  const isPrimaryBusiness = (cars ?? []).find((car) => car.kind === "business")?.id === id
  if (isPrimaryBusiness) {
    const { count: expenseCount } = await supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("category_major", "차량")
      .in("category_minor", ["정비", "주유비", "요소수"])
      .is("deleted_at", null)
    if ((expenseCount ?? 0) > 0) return fail("지출(정비·주유비·요소수)이 이 차에 이어져 있어 지울 수 없어요")
  }

  const { error } = await supabase.from("cars").update({ deleted_at: new Date().toISOString() }).eq("id", id)
  if (error) return fail(`삭제 실패: ${error.message}`)
  await recordAuditLog(supabase, { tableName: "cars", recordId: id, action: "DELETE", beforeData: before })
  refresh()
  return { ok: true }
}

// ─────────────────────────────────────────────
// 설정: 정비 항목 · 기록 종류 (car_items)
// ─────────────────────────────────────────────

function isItemKind(kind: unknown): kind is CarItemKind {
  return kind === "service" || kind === "log"
}

export async function addCarItemAction(kind: CarItemKind, rawName: string): Promise<CarActionResult> {
  if (!isItemKind(kind) || typeof rawName !== "string") return fail("입력값이 올바르지 않아요")
  const name = rawName.trim().replace(/\s+/g, " ")
  if (name.length < 1 || name.length > 20) return fail("이름은 1~20자로 입력하세요")

  const supabase = await createClient()
  const { data: rows, error: readError } = await supabase
    .from("car_items")
    .select("name, sort_order")
    .eq("kind", kind)
    .is("deleted_at", null)
  if (readError) return fail(`저장 실패: ${readError.message}`)
  if ((rows ?? []).some((row) => row.name === name)) return fail("이미 있는 이름이에요")
  const sortOrder = Math.max(0, ...(rows ?? []).map((row) => row.sort_order)) + 10
  const { data, error } = await supabase.from("car_items").insert({ kind, name, sort_order: sortOrder }).select("*").single()
  if (error || !data) return fail(error?.code === "23505" ? "이미 있는 이름이에요" : `저장 실패: ${error?.message}`)
  await recordAuditLog(supabase, { tableName: "car_items", recordId: data.id, action: "CREATE", afterData: data })
  refresh()
  return { ok: true }
}

/** 목록에서 빼기. 이미 적은 기록의 항목·종류 이름은 그대로 남는다. 기록 종류 주유·정비는 못 지운다 */
export async function deleteCarItemAction(id: string): Promise<CarActionResult> {
  if (typeof id !== "string") return fail("입력값이 올바르지 않아요")
  const supabase = await createClient()
  const { data: before } = await supabase.from("car_items").select("*").eq("id", id).is("deleted_at", null).maybeSingle()
  if (!before) return fail("항목을 찾을 수 없어요")
  if (before.kind === "log" && isProtectedLogKind(before.name)) return fail(`'${before.name}'은(는) 지울 수 없어요`)

  const { error } = await supabase.from("car_items").update({ deleted_at: new Date().toISOString() }).eq("id", id)
  if (error) return fail(`삭제 실패: ${error.message}`)
  await recordAuditLog(supabase, { tableName: "car_items", recordId: id, action: "DELETE", beforeData: before })
  refresh()
  return { ok: true }
}

/** 순서 한 칸 앞(-1)·뒤(1)로: 같은 종류 목록에서 이웃과 sort_order를 바꾼다 */
export async function moveCarItemAction(id: string, direction: -1 | 1): Promise<CarActionResult> {
  if (typeof id !== "string" || (direction !== -1 && direction !== 1)) return fail("입력값이 올바르지 않아요")
  const supabase = await createClient()
  const { data: target } = await supabase.from("car_items").select("*").eq("id", id).is("deleted_at", null).maybeSingle()
  if (!target) return fail("항목을 찾을 수 없어요")
  const { data: siblings } = await supabase
    .from("car_items")
    .select("*")
    .eq("kind", target.kind)
    .is("deleted_at", null)
    .order("sort_order")
    .order("name")
  const list = siblings ?? []
  const index = list.findIndex((row) => row.id === id)
  const neighbor = list[index + direction]
  if (index < 0 || !neighbor) return { ok: true }

  // 같은 sort_order가 섞여 있어도 확실히 바뀌게 목록 전체를 10 간격으로 다시 매긴다
  const reordered = [...list]
  reordered[index] = neighbor
  reordered[index + direction] = target
  for (const [i, row] of reordered.entries()) {
    const sortOrder = (i + 1) * 10
    if (row.sort_order === sortOrder) continue
    const { error } = await supabase.from("car_items").update({ sort_order: sortOrder }).eq("id", row.id)
    if (error) return fail(`순서를 바꾸지 못했어요: ${error.message}`)
    await recordAuditLog(supabase, {
      tableName: "car_items",
      recordId: row.id,
      action: "UPDATE",
      beforeData: row,
      afterData: { ...row, sort_order: sortOrder },
    })
  }
  refresh()
  return { ok: true }
}
