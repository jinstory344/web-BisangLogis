import { z } from "zod"

import { parseKm } from "@/lib/car-ledger/constants"
import { parseLiters } from "@/lib/fuel"
import { amountSchema, MAX_AMOUNT } from "@/lib/money"
import type { ExpenseRow } from "@/lib/supabase/database.types"

/**
 * 4.2 지출 등록 폼 검증.
 * 대분류/소분류가 분류 목록에 있는 조합인지는 목록이 DB에서 오기 때문에 여기서 검사하지 않고
 * 서버 액션이 isValidCategoryPairIn으로 검사한다 (여기서는 비어 있지 않은지만 본다).
 * amount/has_tax_invoice는 순수 타입(z.number/z.boolean)을 유지한다 —
 * [[zod-coerce-preprocess-breaks-rhf-zodresolver]] 문제를 피하기 위해
 * FormData 문자열 → 숫자/불리언 변환은 서버 액션에서 처리한다.
 */
/** 정비 항목 줄 (지출 차량 › 정비, 차계부 기록 정비 공용). 금액은 선택(빈칸 null) */
export const serviceItemsSchema = z
  .array(
    z.object({
      item: z.string().trim().min(1, "항목 이름을 입력하세요").max(30, "항목 이름은 30자 이하로 입력하세요"),
      amount: z
        .number()
        .int("금액은 정수여야 합니다")
        .min(0, "금액은 0 이상이어야 합니다")
        .max(MAX_AMOUNT, "금액이 최대 허용치를 초과했습니다")
        .nullable(),
    })
  )
  .max(30, "정비 항목은 30개까지예요")

export const expenseFormSchema = z.object({
  expense_date: z.string().min(1, "지출일자를 입력하세요"),
  category_major: z.string().min(1, "대분류를 선택하세요"),
  category_minor: z.string().min(1, "소분류를 선택하세요"),
  amount: amountSchema,
  payment_method: z.enum(["CARD", "TRANSFER", "CASH"]),
  installment_months: z.number().int().min(1).max(12).optional(),
  /** 카드 이름 (결제방법이 카드일 때만, 빈칸이면 없음) */
  card_name: z.string().trim().max(20, "카드 이름은 20자 이하로 입력하세요"),
  /** 리터 (주유비·요소수일 때만, 빈칸이면 없음). 글자로 두고 서버에서 숫자로 바꾼다 */
  liters: z
    .string()
    .refine((v) => !Number.isNaN(parseLiters(v)), "리터는 숫자로 입력하세요 (예: 120 또는 85.5)"),
  /** 주행거리(차량 › 정비·주유비·요소수일 때만, 빈칸이면 없음). 글자로 두고 서버에서 숫자로 바꾼다 */
  odometer_km: z
    .string()
    .refine((v) => !Number.isNaN(parseKm(v)), "km는 숫자로 입력하세요 (예: 615,848)"),
  /** 정비 항목 줄 (차량 › 정비일 때만). 금액은 선택(빈칸 null) */
  service_items: serviceItemsSchema,
  vendor: z.string().trim(),
  has_tax_invoice: z.boolean(),
  memo: z.string().trim(),
})

export type ServiceItemValue = z.infer<typeof serviceItemsSchema>[number]

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>

export const expenseFormDefaults: ExpenseFormValues = {
  expense_date: "",
  category_major: "",
  category_minor: "",
  amount: 0,
  payment_method: "CARD",
  installment_months: undefined,
  card_name: "",
  liters: "",
  odometer_km: "",
  service_items: [],
  vendor: "",
  has_tax_invoice: false,
  memo: "",
}

/** 저장된 지출 행 → 폼 값 (수정 화면). serviceItems는 그 지출(할부면 1회차)의 정비 항목 줄. */
export function expenseRowToFormValues(
  row: ExpenseRow,
  serviceItems: readonly ServiceItemValue[] = []
): ExpenseFormValues {
  return {
    expense_date: row.expense_date,
    category_major: row.category_major,
    category_minor: row.category_minor,
    amount: row.amount,
    payment_method: row.payment_method ?? "CARD",
    installment_months: row.installment_months ?? undefined,
    card_name: row.card_name ?? "",
    liters: row.liters !== null ? String(row.liters) : "",
    odometer_km: row.odometer_km !== null ? String(row.odometer_km) : "",
    service_items: serviceItems.map((line) => ({ item: line.item, amount: line.amount })),
    vendor: row.vendor ?? "",
    has_tax_invoice: row.has_tax_invoice,
    memo: row.memo ?? "",
  }
}

/**
 * 이전 건 복사 등록(/expenses/new?copy=id)의 기본값: 분류(대·소)·금액·결제방법·카드·할부·비고만
 * 가져오고 지출일자는 오늘로 바꾼다. 폼에 보이지 않는 거래처(vendor)·증빙 수취 여부는
 * 복사하지 않고 새 등록 기본값을 쓴다 — 화면에서 확인할 수 없는 값이 조용히 따라오지 않도록.
 */
export function buildExpenseCopyDefaults(
  row: ExpenseRow,
  today: string,
  serviceItems: readonly ServiceItemValue[] = []
): ExpenseFormValues {
  return {
    ...expenseFormDefaults,
    expense_date: today,
    category_major: row.category_major,
    category_minor: row.category_minor,
    amount: row.amount,
    payment_method: row.payment_method ?? "CARD",
    installment_months: row.installment_months ?? undefined,
    card_name: row.card_name ?? "",
    liters: row.liters !== null ? String(row.liters) : "",
    // 정비 항목은 함께 복사한다 (km는 그때마다 달라서 비운다)
    service_items: serviceItems.map((line) => ({ item: line.item, amount: line.amount })),
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
    // 정비 항목 줄(배열)은 JSON 글자로 보낸다
    fd.set(key, key === "service_items" ? JSON.stringify(value) : String(value))
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
    // 카드 이름도 카드일 때만
    card_name: raw.payment_method === "CARD" ? (raw.card_name ?? "") : "",
    liters: raw.liters ?? "",
    odometer_km: raw.odometer_km ?? "",
    service_items: parseServiceItemsJson(raw.service_items),
    has_tax_invoice: raw.has_tax_invoice === "true",
  }
}

/** FormData의 정비 항목 줄(JSON 글자) → 배열. 없거나 깨졌으면 빈 배열(검증은 스키마가 한다) */
export function parseServiceItemsJson(raw: FormDataEntryValue | undefined): unknown {
  if (typeof raw !== "string" || raw === "") return []
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return []
  }
}
