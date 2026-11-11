import { z } from "zod"

import { amountSchema } from "@/lib/money"
import type { ExpenseRow } from "@/lib/supabase/database.types"

/**
 * 4.2 지출 등록 폼 검증.
 * 대분류/소분류가 분류 목록에 있는 조합인지는 목록이 DB에서 오기 때문에 여기서 검사하지 않고
 * 서버 액션이 isValidCategoryPairIn으로 검사한다 (여기서는 비어 있지 않은지만 본다).
 * amount/has_tax_invoice는 순수 타입(z.number/z.boolean)을 유지한다 —
 * [[zod-coerce-preprocess-breaks-rhf-zodresolver]] 문제를 피하기 위해
 * FormData 문자열 → 숫자/불리언 변환은 서버 액션에서 처리한다.
 */
export const expenseFormSchema = z.object({
  expense_date: z.string().min(1, "지출일자를 입력하세요"),
  category_major: z.string().min(1, "대분류를 선택하세요"),
  category_minor: z.string().min(1, "소분류를 선택하세요"),
  amount: amountSchema,
  payment_method: z.enum(["CARD", "TRANSFER", "CASH"]),
  installment_months: z.number().int().min(1).max(12).optional(),
  vendor: z.string().trim(),
  has_tax_invoice: z.boolean(),
  memo: z.string().trim(),
})

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>

export const expenseFormDefaults: ExpenseFormValues = {
  expense_date: "",
  category_major: "",
  category_minor: "",
  amount: 0,
  payment_method: "CARD",
  installment_months: undefined,
  vendor: "",
  has_tax_invoice: false,
  memo: "",
}

/** 저장된 지출 행 → 폼 값 (수정 화면). */
export function expenseRowToFormValues(row: ExpenseRow): ExpenseFormValues {
  return {
    expense_date: row.expense_date,
    category_major: row.category_major,
    category_minor: row.category_minor,
    amount: row.amount,
    payment_method: row.payment_method ?? "CARD",
    installment_months: row.installment_months ?? undefined,
    vendor: row.vendor ?? "",
    has_tax_invoice: row.has_tax_invoice,
    memo: row.memo ?? "",
  }
}

/**
 * 이전 건 복사 등록(/expenses/new?copy=id)의 기본값: 분류(대·소)·금액·결제방법·할부·비고만
 * 가져오고 지출일자는 오늘로 바꾼다. 폼에 보이지 않는 거래처(vendor)·증빙 수취 여부는
 * 복사하지 않고 새 등록 기본값을 쓴다 — 화면에서 확인할 수 없는 값이 조용히 따라오지 않도록.
 */
export function buildExpenseCopyDefaults(
  row: ExpenseRow,
  today: string
): ExpenseFormValues {
  return {
    ...expenseFormDefaults,
    expense_date: today,
    category_major: row.category_major,
    category_minor: row.category_minor,
    amount: row.amount,
    payment_method: row.payment_method ?? "CARD",
    installment_months: row.installment_months ?? undefined,
    memo: row.memo ?? "",
  }
}

/**
 * 지출 폼 값 → 서버 액션(createExpenseAction/updateExpenseAction)에 넘길 FormData.
 * 서버에서는 coerceExpenseFormData가 이 문자열들을 다시 숫자/불리언으로 되돌린다.
 * (폼 컴포넌트에서 그대로 옮겨 온 함수 — 폼과 테스트가 같은 함수를 쓰도록 export)
 */
export function buildExpenseFormData(values: ExpenseFormValues): FormData {
  const fd = new FormData()
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) return
    fd.set(key, String(value))
  })
  return fd
}

/** FormData(문자열)를 서버에서 파싱하기 직전에 숫자/불리언으로 변환한다. */
export function coerceExpenseFormData(
  raw: Record<string, FormDataEntryValue>
): Record<string, unknown> {
  return {
    ...raw,
    amount: Number(raw.amount),
    // 할부는 카드로 결제했을 때만 의미가 있다. 폼에서 숨겨진 값이나 위조된 값이 따라와도
    // 카드가 아니면 저장하지 않는다.
    installment_months:
      raw.payment_method !== "CARD" ||
      raw.installment_months === "" ||
      raw.installment_months === undefined
        ? undefined
        : Number(raw.installment_months),
    has_tax_invoice: raw.has_tax_invoice === "true",
  }
}
