import { z } from "zod"

import { amountSchema, isVatExemptForPayment } from "@/lib/money"
import type { SaleRow } from "@/lib/supabase/database.types"

/**
 * 4.3.5 매출 등록 폼 입력 검증.
 * 필수값: 매출일자, 상차지, 하차지, 공급가액.
 * 부가세 분리는 서버(create_sale RPC)에서 supply_amount로부터 다시 계산하며,
 * 여기서는 클라이언트 UX(실시간 표시)와 1차 방어선 역할만 한다.
 *
 * 매출은 실제 수익 기록이라 거래처/담당자/차량/기사/화물 정보를 갖지 않는다 —
 * 그쪽은 배차(dispatches) 전용이며 lib/validations/dispatch.ts가 담당한다.
 *
 * 필드 타입은 항상 react-hook-form의 실제 상태 타입(숫자/불리언)과 정확히 일치시킨다.
 * z.coerce/z.preprocess는 쓰지 않는다 — 입력 타입이 `unknown`이 되어 zodResolver와
 * useForm 제네릭이 충돌한다.
 * FormData(문자열) → 숫자/불리언 변환은 서버 액션에서 파싱 직전에 수행한다.
 */
export const saleFormSchema = z.object({
  sale_date: z.string().min(1, "매출일자를 입력하세요"),
  origin: z.string().trim().min(1, "상차지를 입력하세요"),
  destination: z.string().trim().min(1, "하차지를 입력하세요"),
  supply_amount: amountSchema,
  /**
   * 세액 없음 여부. 폼에서 입력받지 않고 지불방법에서 파생한다
   * (isVatExemptForPayment: 세금계산서만 세액 있음). 서버(coerceSaleFormData)가
   * 전송된 값과 상관없이 다시 계산하므로 이 값은 RPC 인자와 화면 미리보기 용도다.
   */
  is_vat_exempt: z.boolean(),
  payment_method: z.enum(["TAX_INVOICE", "TRANSFER", "CASH"]),
  source_major: z.string().trim(),
  source_minor: z.string().trim(),
  source_note: z.string().trim(),
  /**
   * 계산서정보 / 오더자 전화번호 (선택 입력).
   * DB는 nullable이지만 폼 상태는 빈 문자열로 다루고, 서버 액션에서 `|| null`로
   * 정규화해 RPC에 넘긴다.
   */
  billing_entity_name: z.string().trim(),
  order_contact_phone: z.string().trim(),
  memo: z.string().trim(),
})

export type SaleFormValues = z.infer<typeof saleFormSchema>

export const saleFormDefaults: SaleFormValues = {
  sale_date: "",
  origin: "",
  destination: "",
  supply_amount: 0,
  is_vat_exempt: false,
  payment_method: "TAX_INVOICE",
  source_major: "",
  source_minor: "",
  source_note: "",
  billing_entity_name: "",
  order_contact_phone: "",
  memo: "",
}

/**
 * 저장된 매출 행 → 폼 값 (수정 화면·복사 등록 공용).
 * DB의 nullable text는 폼 상태에서 빈 문자열로 다룬다 (서버 액션이 다시 `|| null`로 정규화).
 */
export function saleRowToFormValues(row: SaleRow): SaleFormValues {
  return {
    sale_date: row.sale_date,
    origin: row.origin,
    destination: row.destination,
    supply_amount: row.supply_amount,
    // 저장된 is_vat_exempt가 아니라 지불방법 규칙을 따른다 — 수정·복사 화면의 세액 미리보기가
    // 저장 시 서버가 계산할 값과 항상 같아야 한다.
    is_vat_exempt: isVatExemptForPayment(row.payment_method),
    payment_method: row.payment_method,
    source_major: row.source_major ?? "",
    source_minor: row.source_minor ?? "",
    source_note: row.source_note ?? "",
    billing_entity_name: row.billing_entity_name ?? "",
    order_contact_phone: row.order_contact_phone ?? "",
    memo: row.memo ?? "",
  }
}

/**
 * 이전 건 복사 등록(/sales/new?copy=id)의 기본값: 폼의 모든 필드를 그대로 가져오고
 * 매출일자만 오늘(서울 기준, 호출 쪽에서 getTodayInSeoul()로 넘김)로 바꾼다.
 * 부가세·합계는 폼 값이 아니므로 복사하지 않는다 — 저장 시 RPC가 공급가액으로 다시 계산한다.
 */
export function buildSaleCopyDefaults(
  row: SaleRow,
  today: string
): SaleFormValues {
  return { ...saleRowToFormValues(row), sale_date: today }
}

/**
 * 매출 폼 값 → 서버 액션(createSaleAction/updateSaleAction)에 넘길 FormData.
 * 서버에서는 coerceSaleFormData가 이 문자열들을 다시 숫자/불리언으로 되돌린다.
 * (폼 컴포넌트에서 그대로 옮겨 온 함수 — 폼과 테스트가 같은 함수를 쓰도록 export)
 */
export function buildSaleFormData(values: SaleFormValues): FormData {
  const fd = new FormData()
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) return
    fd.set(key, String(value))
  })
  // 폼 상태가 어긋나 있어도 항상 지불방법 규칙대로 보낸다 (서버도 다시 계산한다).
  fd.set("is_vat_exempt", String(isVatExemptForPayment(values.payment_method)))
  return fd
}

/** FormData(문자열)를 서버에서 파싱하기 직전에 숫자/불리언으로 변환한다. */
export function coerceSaleFormData(
  raw: Record<string, FormDataEntryValue>
): Record<string, unknown> {
  return {
    ...raw,
    supply_amount: Number(raw.supply_amount),
    // 세액 없음 여부는 클라이언트가 보낸 값을 믿지 않고 지불방법으로 서버에서 정한다.
    is_vat_exempt: isVatExemptForPayment(String(raw.payment_method ?? "")),
    // 선택 필드가 아예 전송되지 않은 경우(구버전 클라이언트 등)도 "미입력"으로 취급한다.
    billing_entity_name: raw.billing_entity_name ?? "",
    order_contact_phone: raw.order_contact_phone ?? "",
  }
}
