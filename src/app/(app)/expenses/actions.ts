"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { recordAuditLog } from "@/lib/audit/log"
import { isValidCategoryPairIn } from "@/lib/constants/expense-categories"
import {
  getExpenseGroupRows,
  insertExpenseWithInstallments,
  softDeleteExpense,
} from "@/lib/expense-installment-db"
import { checkInstallment, isInstallment } from "@/lib/installment"
import { softDelete } from "@/lib/soft-delete/soft-delete"
import { safeReturnPath } from "@/lib/return-to"
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
  const installmentError = checkInstallment(values.amount, values.installment_months)
  if (installmentError) return { error: installmentError }

  const supabase = await createClient()
  const { vendor, memo, installment_months, card_name, ...rest } = values
  // 할부(2개월 이상)면 달마다 한 줄씩 나눠 저장한다
  const result = await insertExpenseWithInstallments(supabase, {
    ...rest,
    installment_months: installment_months ?? null,
    card_name: card_name || null,
    vendor: vendor || null,
    memo: memo || null,
  })
  if ("error" in result) {
    return { error: `저장 실패: ${result.error}` }
  }

  revalidatePath("/expenses")
  revalidatePath("/")
  // 등록이 끝나면 장부(홈)로 돌아간다.
  redirect("/")
}

export async function updateExpenseAction(
  id: string,
  returnTo: string | null,
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
  const installmentError = checkInstallment(values.amount, values.installment_months)
  if (installmentError) return { error: installmentError }

  const supabase = await createClient()
  const { vendor, memo, installment_months, card_name, ...rest } = values
  const updateValues = {
    ...rest,
    installment_months: installment_months ?? null,
    card_name: card_name || null,
    vendor: vendor || null,
    memo: memo || null,
  }

  // 할부 회차면 묶음 전체(수정 화면은 첫 회차 날짜·총액을 보여 준다)
  const groupRows = await getExpenseGroupRows(supabase, id)
  const before = groupRows.find((row) => row.id === id)
  if (!before) {
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

  if (before.installment_group_id || isInstallment(installment_months)) {
    // 할부가 끼면 회차 줄들을 새로 만든다: 새 줄을 먼저 넣고(실패하면 예전 그대로) 예전 줄을 지운다.
    const result = await insertExpenseWithInstallments(supabase, updateValues)
    if ("error" in result) {
      return { error: `저장 실패: ${result.error}` }
    }
    try {
      for (const row of groupRows) await softDelete(supabase, "expenses", row.id)
    } catch (error) {
      return {
        error: `새 내용은 저장했지만 예전 줄을 지우지 못했어요. 지출 목록에서 예전 건을 지워 주세요 (${
          error instanceof Error ? error.message : "알 수 없는 오류"
        })`,
      }
    }
  } else {
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
  }

  revalidatePath("/expenses")
  // 비상(홈) 화면의 합계·목록·미입금도 바로 바뀌게
  revalidatePath("/")
  // 저장하면 수정을 시작한 화면으로 돌아간다. 모르면 지출 목록으로.
  redirect(safeReturnPath(returnTo) ?? "/expenses")
}

export async function deleteExpenseAction(id: string): Promise<void> {
  const supabase = await createClient()
  // 할부 회차를 지우면 그 할부 전체가 함께 지워진다
  await softDeleteExpense(supabase, id)
  revalidatePath("/expenses")
  // 비상(홈) 화면의 합계·목록·미입금도 바로 바뀌게
  revalidatePath("/")
}
