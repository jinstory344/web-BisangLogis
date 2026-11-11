import { describe, expect, it } from "vitest"

import type { ExpenseRow } from "@/lib/supabase/database.types"

import {
  buildExpenseCopyDefaults,
  buildExpenseFormData,
  coerceExpenseFormData,
  expenseFormDefaults,
  expenseFormSchema,
  expenseRowToFormValues,
  type ExpenseFormValues,
} from "./expense"

const baseRow: ExpenseRow = {
  id: "22222222-2222-2222-2222-222222222222",
  created_at: "2026-11-01T01:00:00+00:00",
  updated_at: null,
  deleted_at: null,
  expense_date: "2026-11-01",
  category_major: "차량",
  category_minor: "유류",
  amount: 50000,
  payment_method: "CARD",
  installment_months: 3,
  vendor: "OO주유소",
  has_tax_invoice: true,
  memo: "만땅",
}

/**
 * 폼이 실제로 쓰는 buildExpenseFormData로 FormData를 만들고, 서버 액션과 똑같이
 * Object.fromEntries로 펼친다.
 */
function submittedEntries(
  values: ExpenseFormValues
): Record<string, FormDataEntryValue> {
  return Object.fromEntries(buildExpenseFormData(values)) as Record<
    string,
    FormDataEntryValue
  >
}

describe("expenseRowToFormValues (수정 화면)", () => {
  it("모든 필드를 그대로 옮기고 null은 폼 기본 표현으로 바꾼다", () => {
    expect(expenseRowToFormValues(baseRow)).toEqual({
      expense_date: "2026-11-01",
      category_major: "차량",
      category_minor: "유류",
      amount: 50000,
      payment_method: "CARD",
      installment_months: 3,
      vendor: "OO주유소",
      has_tax_invoice: true,
      memo: "만땅",
    })

    const nulls = expenseRowToFormValues({
      ...baseRow,
      payment_method: null,
      installment_months: null,
      vendor: null,
      memo: null,
    })
    expect(nulls.payment_method).toBe("CARD")
    expect(nulls.installment_months).toBeUndefined()
    expect(nulls.vendor).toBe("")
    expect(nulls.memo).toBe("")
  })
})

describe("buildExpenseCopyDefaults (이전 건 복사)", () => {
  it("분류·금액·결제방법·할부·비고를 가져오고 날짜만 오늘로 바꾼다", () => {
    const copied = buildExpenseCopyDefaults(baseRow, "2026-11-08")

    expect(copied.expense_date).toBe("2026-11-08")
    expect(copied.category_major).toBe("차량")
    expect(copied.category_minor).toBe("유류")
    expect(copied.amount).toBe(50000)
    expect(copied.payment_method).toBe("CARD")
    expect(copied.installment_months).toBe(3)
    expect(copied.memo).toBe("만땅")
  })

  it("폼에 보이지 않는 거래처·증빙 수취 여부는 새 등록 기본값을 쓴다", () => {
    const copied = buildExpenseCopyDefaults(baseRow, "2026-11-08")

    expect(copied.vendor).toBe(expenseFormDefaults.vendor)
    expect(copied.has_tax_invoice).toBe(expenseFormDefaults.has_tax_invoice)
  })

  it("결제방법이 비어 있던 옛 데이터는 카드, 할부 없음은 undefined", () => {
    const copied = buildExpenseCopyDefaults(
      { ...baseRow, payment_method: null, installment_months: null },
      "2026-11-08"
    )
    expect(copied.payment_method).toBe("CARD")
    expect(copied.installment_months).toBeUndefined()
  })

  it("'기타'로 직접 입력한 소분류도 그대로 복사되고 검증을 통과한다", () => {
    const copied = buildExpenseCopyDefaults(
      { ...baseRow, category_minor: "세차" },
      "2026-11-08"
    )
    expect(copied.category_minor).toBe("세차")

    const parsed = expenseFormSchema.safeParse(
      coerceExpenseFormData(submittedEntries(copied))
    )
    expect(parsed.success).toBe(true)
  })
})

describe("buildExpenseFormData (폼 → 서버 액션 직렬화)", () => {
  it("할부 미선택(undefined)은 전송하지 않고, 불리언은 문자열로 보낸다", () => {
    const fd = buildExpenseFormData({
      ...expenseRowToFormValues(baseRow),
      installment_months: undefined,
      has_tax_invoice: false,
    })

    expect(fd.has("installment_months")).toBe(false)
    expect(fd.get("has_tax_invoice")).toBe("false")
    expect(fd.get("amount")).toBe("50000")
  })
})

describe("할부는 카드일 때만 저장된다 (coerceExpenseFormData)", () => {
  const withInstallment = (payment_method: "CARD" | "TRANSFER" | "CASH") =>
    submittedEntries({
      ...expenseFormDefaults,
      expense_date: "2026-11-01",
      category_major: "차량",
      category_minor: "유류",
      amount: 50000,
      payment_method,
      installment_months: 3,
    })

  it("카드면 고른 할부 개월 수를 숫자로 그대로 둔다", () => {
    const parsed = expenseFormSchema.parse(
      coerceExpenseFormData(withInstallment("CARD"))
    )
    expect(parsed.installment_months).toBe(3)
  })

  it("계좌이체·현금이면 폼에서 숨겨진 값이나 위조된 값이 와도 할부를 지운다", () => {
    for (const method of ["TRANSFER", "CASH"] as const) {
      const parsed = expenseFormSchema.parse(
        coerceExpenseFormData(withInstallment(method))
      )
      expect(parsed.installment_months).toBeUndefined()
    }
  })

  it("결제방법이 아예 안 와도 할부는 저장하지 않는다 (검증은 결제방법 누락으로 실패)", () => {
    const entries = withInstallment("CARD")
    delete entries.payment_method
    expect(coerceExpenseFormData(entries).installment_months).toBeUndefined()
    expect(
      expenseFormSchema.safeParse(coerceExpenseFormData(entries)).success
    ).toBe(false)
  })
})
