"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { recordAuditLog } from "@/lib/audit/log"
import { isValidCategoryPairIn } from "@/lib/constants/expense-categories"
import { softDelete } from "@/lib/soft-delete/soft-delete"
import { createClient } from "@/lib/supabase/server"
import {
  coerceExpenseFormData,
  expenseFormSchema,
} from "@/lib/validations/expense"

import { getExpenseCategories } from "./categories"

export interface ExpenseActionState {
  error: string | null
}

const INVALID_CATEGORY_MESSAGE = "대분류/소분류 조합이 올바르지 않습니다"

/** 분류 목록(DB)에 있는 대분류/소분류 조합인지 확인한다. */
async function hasValidCategory(major: string, minor: string): Promise<boolean> {
  const { tree } = await getExpenseCategories()
  return isValidCategoryPairIn(tree, major, minor)
}

export async function createExpenseAction(
  _prevState: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const parsed = expenseFormSchema.safeParse(
    coerceExpenseFormData(Object.fromEntries(formData))
  )
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" }
  }

  const values = parsed.data
  if (!(await hasValidCategory(values.category_major, values.category_minor))) {
    return { error: INVALID_CATEGORY_MESSAGE }
  }
  const supabase = await createClient()
  const { vendor, memo, ...rest } = values
  const insertValues = {
    ...rest,
    vendor: vendor || null,
    memo: memo || null,
  }

  const { data, error } = await supabase
    .from("expenses")
    .insert(insertValues)
    .select("id")
    .single()

  if (error) {
    return { error: `저장 실패: ${error.message}` }
  }

  await recordAuditLog(supabase, {
    tableName: "expenses",
    recordId: data.id,
    action: "CREATE",
    afterData: insertValues,
  })

  revalidatePath("/expenses")
  revalidatePath("/")
  // 등록이 끝나면 장부(홈)로 돌아간다.
  redirect("/")
}

export async function updateExpenseAction(
  id: string,
  _prevState: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const parsed = expenseFormSchema.safeParse(
    coerceExpenseFormData(Object.fromEntries(formData))
  )
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" }
  }

  const values = parsed.data
  const supabase = await createClient()
  const { vendor, memo, ...rest } = values
  const updateValues = {
    ...rest,
    vendor: vendor || null,
    memo: memo || null,
  }

  const { data: before, error: fetchError } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchError || !before) {
    return { error: "대상 지출을 찾을 수 없습니다" }
  }

  // 분류를 바꾸지 않았으면 (지워진 분류가 붙은 예전 지출이라도) 그대로 저장할 수 있다.
  const categoryUnchanged =
    values.category_major === before.category_major &&
    values.category_minor === before.category_minor
  if (
    !categoryUnchanged &&
    !(await hasValidCategory(values.category_major, values.category_minor))
  ) {
    return { error: INVALID_CATEGORY_MESSAGE }
  }

  const { error } = await supabase
    .from("expenses")
    .update(updateValues)
    .eq("id", id)

  if (error) {
    return { error: `저장 실패: ${error.message}` }
  }

  await recordAuditLog(supabase, {
    tableName: "expenses",
    recordId: id,
    action: "UPDATE",
    beforeData: before,
    afterData: { ...before, ...updateValues },
  })

  revalidatePath("/expenses")
  // 비상(홈) 화면의 합계·목록·미입금도 바로 바뀌게
  revalidatePath("/")
  redirect("/expenses")
}

export async function deleteExpenseAction(id: string): Promise<void> {
  const supabase = await createClient()
  await softDelete(supabase, "expenses", id)
  revalidatePath("/expenses")
  // 비상(홈) 화면의 합계·목록·미입금도 바로 바뀌게
  revalidatePath("/")
}
