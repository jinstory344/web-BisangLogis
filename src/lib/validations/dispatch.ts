import { z } from "zod"

import { amountSchema } from "@/lib/money"

/**
 * 4.3.5 배차 등록 폼 입력 검증.
 * 필수값: 운송일자, 거래처, 상차지, 하차지, 합계운임.
 * 부가세 분리는 서버(create_dispatch RPC)에서 total_amount로부터 다시 계산하며,
 * 여기서는 클라이언트 UX(실시간 표시)와 1차 방어선 역할만 한다.
 *
 * 필드 타입은 항상 react-hook-form의 실제 상태 타입(숫자/불리언)과 정확히 일치시킨다.
 * z.coerce/z.preprocess는 쓰지 않는다 — 입력 타입이 `unknown`이 되어 zodResolver와
 * useForm 제네릭이 충돌한다 ([[supabase-database-types-must-use-type-alias]]와 유사한 함정).
 * FormData(문자열) → 숫자/불리언 변환은 서버 액션에서 파싱 직전에 수행한다.
 */
export const dispatchFormSchema = z.object({
  dispatch_date: z.string().min(1, "운송일자를 입력하세요"),
  client_id: z.string().min(1, "거래처를 선택하세요"),
  client_name: z.string().min(1),
  origin: z.string().trim().min(1, "상차지를 입력하세요"),
  destination: z.string().trim().min(1, "하차지를 입력하세요"),
  pallet_count: z.number().int().min(0).max(9999).optional(),
  vehicle_id: z.string().optional(),
  plate_no_snapshot: z.string().trim(),
  driver_name_snapshot: z.string().trim(),
  driver_phone_snapshot: z.string().trim(),
  carrier_name: z.string().trim(),
  dispatcher_name: z.string().trim(),
  total_amount: amountSchema,
  is_vat_exempt: z.boolean(),
  fee_amount: amountSchema,
  payment_method: z.enum(["TAX_INVOICE", "TRANSFER", "CASH"]),
  memo: z.string().trim(),
})

export type DispatchFormValues = z.infer<typeof dispatchFormSchema>

export const dispatchFormDefaults: DispatchFormValues = {
  dispatch_date: "",
  client_id: "",
  client_name: "",
  origin: "",
  destination: "",
  pallet_count: undefined,
  vehicle_id: "",
  plate_no_snapshot: "",
  driver_name_snapshot: "",
  driver_phone_snapshot: "",
  carrier_name: "",
  dispatcher_name: "",
  total_amount: 0,
  is_vat_exempt: false,
  fee_amount: 0,
  payment_method: "TRANSFER",
  memo: "",
}

/** FormData(문자열)를 서버에서 파싱하기 직전에 숫자/불리언으로 변환한다. */
export function coerceDispatchFormData(
  raw: Record<string, FormDataEntryValue>
): Record<string, unknown> {
  return {
    ...raw,
    pallet_count:
      raw.pallet_count === "" || raw.pallet_count === undefined
        ? undefined
        : Number(raw.pallet_count),
    total_amount: Number(raw.total_amount),
    fee_amount: Number(raw.fee_amount),
    is_vat_exempt: raw.is_vat_exempt === "true",
  }
}
