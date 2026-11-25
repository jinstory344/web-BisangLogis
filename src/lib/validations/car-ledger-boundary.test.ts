import { describe, expect, it } from "vitest"

import { parseKm } from "@/lib/car-ledger/constants"
import { MAX_AMOUNT } from "@/lib/money"

import {
  buildExpenseFormData,
  coerceExpenseFormData,
  expenseFormDefaults,
  expenseFormSchema,
  type ExpenseFormValues,
} from "./expense"

/** 폼 값 → FormData → (서버) coerce → zod, 서버 액션과 같은 순서 */
function submit(values: ExpenseFormValues) {
  const raw = Object.fromEntries(buildExpenseFormData(values)) as Record<string, FormDataEntryValue>
  return expenseFormSchema.safeParse(coerceExpenseFormData(raw))
}

const service: ExpenseFormValues = {
  ...expenseFormDefaults,
  expense_date: "2026-11-25",
  category_major: "차량",
  category_minor: "정비",
  amount: 1_000_000,
  payment_method: "CARD",
  card_name: "신한",
}

describe("차계부 경계값 (QA)", () => {
  it("km: 빈칸·쉼표·km 꼬리·상한", () => {
    expect(parseKm("")).toBeNull()
    expect(parseKm("   ")).toBeNull()
    expect(parseKm("615,848")).toBe(615848)
    expect(parseKm("615,848km")).toBe(615848)
    expect(parseKm("615848 KM")).toBe(615848)
    expect(parseKm("9,999,999")).toBe(9_999_999)
    expect(parseKm("10,000,000")).toBeNaN()
    expect(parseKm("-5")).toBeNaN()
    expect(parseKm("1.5")).toBeNaN()
  })

  it("정비 항목 금액: 0~상한, 빈칸(null) 허용, 음수·소수·상한 초과 거부", () => {
    const withItem = (amount: number | null) => submit({ ...service, service_items: [{ item: "엔진오일", amount }] })
    expect(withItem(null).success).toBe(true)
    expect(withItem(0).success).toBe(true)
    expect(withItem(MAX_AMOUNT).success).toBe(true)
    expect(withItem(MAX_AMOUNT + 1).success).toBe(false)
    expect(withItem(-1).success).toBe(false)
    expect(withItem(1.5).success).toBe(false)
  })

  it("정비 항목 이름: 공백만·31자 거부, 31개 이상 거부", () => {
    expect(submit({ ...service, service_items: [{ item: "  ", amount: null }] }).success).toBe(false)
    expect(submit({ ...service, service_items: [{ item: "가".repeat(31), amount: null }] }).success).toBe(false)
    const many = Array.from({ length: 31 }, (_, i) => ({ item: `항목${i}`, amount: null }))
    expect(submit({ ...service, service_items: many }).success).toBe(false)
  })

  it("할부 + 항목 + km가 함께 통과한다", () => {
    const parsed = submit({
      ...service,
      installment_months: 3,
      odometer_km: "615,848",
      service_items: [
        { item: "엔진오일", amount: 80_000 },
        { item: "배터리", amount: 150_000 },
      ],
    })
    expect(parsed.success).toBe(true)
    expect(parsed.data?.installment_months).toBe(3)
    expect(parsed.data?.service_items).toHaveLength(2)
    expect(parseKm(parsed.data?.odometer_km ?? "")).toBe(615848)
  })

  it("지출 금액 규칙(PRD 4.3)은 그대로: 상한 통과, 상한+1·음수 거부", () => {
    expect(submit({ ...service, amount: MAX_AMOUNT }).success).toBe(true)
    expect(submit({ ...service, amount: MAX_AMOUNT + 1 }).success).toBe(false)
    expect(submit({ ...service, amount: -1 }).success).toBe(false)
  })

  it("정비가 아닌 분류에서도 km 빈칸·항목 빈 배열이면 통과 (하이패스 등 기존 지출)", () => {
    const parsed = submit({ ...service, category_minor: "하이패스", service_items: [], odometer_km: "" })
    expect(parsed.success).toBe(true)
  })
})
