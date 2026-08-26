import { z } from "zod"

import { amountSchema } from "@/lib/money"

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

/** FormData(문자열)를 서버에서 파싱하기 직전에 숫자/불리언으로 변환한다. */
export function coerceSaleFormData(
  raw: Record<string, FormDataEntryValue>
): Record<string, unknown> {
  return {
    ...raw,
    supply_amount: Number(raw.supply_amount),
    is_vat_exempt: raw.is_vat_exempt === "true",
    // 선택 필드가 아예 전송되지 않은 경우(구버전 클라이언트 등)도 "미입력"으로 취급한다.
    billing_entity_name: raw.billing_entity_name ?? "",
    order_contact_phone: raw.order_contact_phone ?? "",
  }
}
