import { z } from "zod"

import { isValidCategoryPair } from "@/lib/constants/expense-categories"
import { amountSchema } from "@/lib/money"

/**
 * 4.2 지출 등록 폼 검증.
 * amount/has_tax_invoice는 순수 타입(z.number/z.boolean)을 유지한다 —
 * [[zod-coerce-preprocess-breaks-rhf-zodresolver]] 문제를 피하기 위해
 * FormData 문자열 → 숫자/불리언 변환은 서버 액션에서 처리한다.
 */
export const expenseFormSchema = z
  .object({
    expense_date: z.string().min(1, "지출일자를 입력하세요"),
    category_major: z.string().min(1, "대분류를 선택하세요"),
    category_minor: z.string().min(1, "소분류를 선택하세요"),
    amount: amountSchema,
    payment_method: z.enum(["CARD", "TRANSFER", "CASH"]),
    vendor: z.string().trim(),
    has_tax_invoice: z.boolean(),
    memo: z.string().trim(),
  })
  .refine(
    (v) => isValidCategoryPair(v.category_major, v.category_minor),
    { message: "대분류/소분류 조합이 올바르지 않습니다", path: ["category_minor"] }
  )

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>

export const expenseFormDefaults: ExpenseFormValues = {
  expense_date: "",
  category_major: "",
  category_minor: "",
  amount: 0,
  payment_method: "CARD",
  vendor: "",
  has_tax_invoice: false,
  memo: "",
}

/** FormData(문자열)를 서버에서 파싱하기 직전에 숫자/불리언으로 변환한다. */
export function coerceExpenseFormData(
  raw: Record<string, FormDataEntryValue>
): Record<string, unknown> {
  return {
    ...raw,
    amount: Number(raw.amount),
    has_tax_invoice: raw.has_tax_invoice === "true",
  }
}
