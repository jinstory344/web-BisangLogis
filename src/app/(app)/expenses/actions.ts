"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { recordAuditLog } from "@/lib/audit/log"
import { softDelete } from "@/lib/soft-delete/soft-delete"
import { createClient } from "@/lib/supabase/server"
import {
  coerceExpenseFormData,
  expenseFormSchema,
} from "@/lib/validations/expense"

export interface ExpenseActionState {
  error: string | null
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
  redirect("/expenses")
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
  redirect("/expenses")
}

export async function deleteExpenseAction(id: string): Promise<void> {
  const supabase = await createClient()
  await softDelete(supabase, "expenses", id)
  revalidatePath("/expenses")
}
