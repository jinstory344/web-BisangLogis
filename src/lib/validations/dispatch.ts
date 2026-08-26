import { z } from "zod"

import { amountSchema } from "@/lib/money"

/**
 * 4.3.5 배차 등록 폼 입력 검증.
 * 필수값: 운송일자, 거래처, 상차지, 하차지.
 * 배차가 다루는 금액은 지출 성격의 단순 기록(운임/수수료)뿐이며 부가세 분리 대상이
 * 아니다 — 공급가액/부가세/지불방법/출처는 매출(sales) 전용이고
 * lib/validations/sales.ts가 담당한다.
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
  contact_name: z.string().trim(),
  origin: z.string().trim().min(1, "상차지를 입력하세요"),
  destination: z.string().trim().min(1, "하차지를 입력하세요"),
  dropoff_type: z.enum(["SAME_DAY", "NEXT_DAY"]),
  /**
   * 적재함 종류(선택 입력). 미선택은 빈 문자열로 표현하고(RHF select의 실제 상태 타입과 일치),
   * source_major 등 다른 선택 필드와 동일하게 서버 액션에서 `|| null`로 정규화해 RPC에 넘긴다.
   * DB는 빈 문자열을 허용하지 않으므로 null이어야 한다.
   */
  cargo_box_type: z.enum([
    "",
    "CARGO",
    "BOX",
    "WING",
    "REFRIGERATED",
    "OTHER",
  ]),
  /**
   * 선택 입력 숫자 필드의 "미입력"은 반드시 null로 표현한다 (undefined 금지).
   * react-hook-form의 useController는 값을 `get(_formValues, name,
   * get(_defaultValues, name))`로 읽는데, 이 get()은 값이 undefined면
   * defaultValues로 되돌린다. 따라서 undefined로 비우면 수정 폼에서
   * 입력란에 기존 값이 되살아나 보이면서 저장은 null로 되는 불일치가 생긴다.
   * null은 "undefined 아님"이라 그대로 유지되어 화면과 저장값이 일치한다.
   */
  pallet_count: z.number().int().min(0).max(9999).nullable(),
  weight_ton: z.number().min(0).max(9999.99).nullable(),
  vehicle_id: z.string().optional(),
  plate_no_snapshot: z.string().trim(),
  driver_name_snapshot: z.string().trim(),
  driver_phone_snapshot: z.string().trim(),
  /**
   * 운임(선택 입력) — 기사/차량에게 지급할 금액.
   * 미입력은 pallet_count/weight_ton과 동일하게 null로 표현한다(위 주석 참고).
   */
  freight_amount: amountSchema.nullable(),
  /** 수수료 — DB가 NOT NULL default 0이므로 미입력은 0으로 취급한다. */
  fee_amount: amountSchema,
  memo: z.string().trim(),
})

export type DispatchFormValues = z.infer<typeof dispatchFormSchema>

export const dispatchFormDefaults: DispatchFormValues = {
  dispatch_date: "",
  client_id: "",
  client_name: "",
  contact_name: "",
  origin: "",
  destination: "",
  dropoff_type: "SAME_DAY",
  cargo_box_type: "",
  pallet_count: null,
  weight_ton: null,
  vehicle_id: "",
  plate_no_snapshot: "",
  driver_name_snapshot: "",
  driver_phone_snapshot: "",
  freight_amount: null,
  fee_amount: 0,
  memo: "",
}

/** FormData(문자열)를 서버에서 파싱하기 직전에 숫자/불리언으로 변환한다. */
export function coerceDispatchFormData(
  raw: Record<string, FormDataEntryValue>
): Record<string, unknown> {
  return {
    ...raw,
    // 선택 필드가 아예 전송되지 않은 경우(구버전 클라이언트 등)도 "미선택"으로 취급한다.
    cargo_box_type: raw.cargo_box_type ?? "",
    // 미입력(빈 문자열이거나 아예 전송되지 않음)은 null로 정규화한다.
    // 폼의 buildFormData가 null/undefined 필드를 아예 전송하지 않으므로
    // 두 경우 모두 여기서 null이 된다.
    pallet_count:
      raw.pallet_count === "" || raw.pallet_count === undefined
        ? null
        : Number(raw.pallet_count),
    weight_ton:
      raw.weight_ton === "" || raw.weight_ton === undefined
        ? null
        : Number(raw.weight_ton),
    freight_amount:
      raw.freight_amount === "" || raw.freight_amount === undefined
        ? null
        : Number(raw.freight_amount),
    // DB가 NOT NULL default 0이므로 미입력은 0으로 채운다.
    fee_amount:
      raw.fee_amount === "" || raw.fee_amount === undefined
        ? 0
        : Number(raw.fee_amount),
  }
}
