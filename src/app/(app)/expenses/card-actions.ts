"use server"

import { revalidatePath } from "next/cache"

import { recordAuditLog } from "@/lib/audit/log"
import { checkCardName, moveCardName } from "@/lib/constants/expense-cards"
import { createClient } from "@/lib/supabase/server"

import { getExpenseCards } from "./cards"

export type CardActionResult = { ok: true; names: string[] } | { ok: false; error: string }

function fail(error: string): CardActionResult {
  return { ok: false, error }
}

/** 편집할 수 있는 상태인지 확인하고 지금 목록을 돌려준다 */
async function loadEditable(): Promise<string[] | null> {
  const { names, editable } = await getExpenseCards()
  return editable ? names : null
}

async function done(): Promise<CardActionResult> {
  revalidatePath("/", "layout")
  return { ok: true, names: (await getExpenseCards()).names }
}

/** 카드 추가: 목록 맨 뒤에 붙는다 */
export async function addExpenseCardAction(rawName: unknown): Promise<CardActionResult> {
  if (typeof rawName !== "string") return fail("입력값이 올바르지 않아요")
  const names = await loadEditable()
  if (!names) return fail("카드를 저장할 수 없는 상태예요")
  const check = checkCardName(names, rawName)
  if (!check.ok) return fail(check.error)

  const supabase = await createClient()
  const { data: last } = await supabase
    .from("expense_cards")
    .select("sort_order")
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)
  const { data, error } = await supabase
    .from("expense_cards")
    .insert({ name: check.name, sort_order: (last?.[0]?.sort_order ?? 0) + 10 })
    .select("*")
    .single()
  if (error) {
    if (error.code === "23505") return fail("이미 있는 카드예요")
    return fail(`카드 저장 실패: ${error.message}`)
  }
  await recordAuditLog(supabase, {
    tableName: "expense_cards",
    recordId: data.id,
    action: "CREATE",
    afterData: data,
  })
  return done()
}

/** 카드 이름 바꾸기: 이미 등록한 지출의 카드 이름도 함께 바꾼다 */
export async function renameExpenseCardAction(
  rawCurrent: unknown,
  rawName: unknown
): Promise<CardActionResult> {
  if (typeof rawCurrent !== "string" || typeof rawName !== "string") {
    return fail("입력값이 올바르지 않아요")
  }
  const names = await loadEditable()
  if (!names) return fail("카드를 저장할 수 없는 상태예요")
  if (!names.includes(rawCurrent)) return fail("카드를 찾을 수 없어요")
  const check = checkCardName(names, rawName, rawCurrent)
  if (!check.ok) return fail(check.error)
  if (check.name === rawCurrent) return { ok: true, names }

  const supabase = await createClient()
  const { data: before, error: fetchError } = await supabase
    .from("expense_cards")
    .select("*")
    .is("deleted_at", null)
    .eq("name", rawCurrent)
    .single()
  if (fetchError) return fail(`카드 조회 실패: ${fetchError.message}`)

  const { data: after, error } = await supabase
    .from("expense_cards")
    .update({ name: check.name })
    .eq("id", before.id)
    .select("*")
    .single()
  if (error) {
    if (error.code === "23505") return fail("이미 있는 카드예요")
    return fail(`카드 이름 바꾸기 실패: ${error.message}`)
  }
  await recordAuditLog(supabase, {
    tableName: "expense_cards",
    recordId: after.id,
    action: "UPDATE",
    beforeData: before,
    afterData: after,
  })

  const { error: expenseError } = await supabase
    .from("expenses")
    .update({ card_name: check.name })
    .eq("card_name", rawCurrent)
  if (expenseError) {
    return fail(`카드 이름은 바꿨지만 지난 지출에 반영하지 못했어요: ${expenseError.message}`)
  }
  return done()
}

/** 카드 삭제(소프트 삭제). 이미 등록한 지출에는 카드 이름이 글자로 남는다 */
export async function deleteExpenseCardAction(rawName: unknown): Promise<CardActionResult> {
  if (typeof rawName !== "string") return fail("입력값이 올바르지 않아요")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("expense_cards")
    .update({ deleted_at: new Date().toISOString() })
    .is("deleted_at", null)
    .eq("name", rawName)
    .select("*")
  if (error) return fail(`카드 삭제 실패: ${error.message}`)
  if (!data || data.length === 0) return fail("카드를 찾을 수 없어요")
  for (const row of data) {
    await recordAuditLog(supabase, {
      tableName: "expense_cards",
      recordId: row.id,
      action: "DELETE",
      beforeData: row,
    })
  }
  return done()
}

/** 카드 순서 바꾸기: 한 칸 앞(-1)·뒤(+1). 전체에 10, 20, 30… 정렬값을 다시 매긴다 */
export async function moveExpenseCardAction(
  rawName: unknown,
  rawDirection: unknown
): Promise<CardActionResult> {
  if (typeof rawName !== "string" || (rawDirection !== -1 && rawDirection !== 1)) {
    return fail("입력값이 올바르지 않아요")
  }
  const names = await loadEditable()
  if (!names) return fail("카드를 저장할 수 없는 상태예요")
  const moved = moveCardName(names, rawName, rawDirection)
  if (!moved.ok) return fail(moved.error)

  const supabase = await createClient()
  for (const [index, name] of moved.names.entries()) {
    const { error } = await supabase
      .from("expense_cards")
      .update({ sort_order: (index + 1) * 10 })
      .is("deleted_at", null)
      .eq("name", name)
    if (error) return fail(`순서 저장 실패: ${error.message}`)
  }
  return done()
}
