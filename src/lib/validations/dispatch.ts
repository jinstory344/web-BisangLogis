import { z } from "zod"

import { amountSchema } from "@/lib/money"
import type { DispatchRow } from "@/lib/supabase/database.types"

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
  /** 담당자 연락처(선택). 담당자가 건마다 달라 담당자명과 함께 건별로 적는다. */
  contact_phone: z.string().trim(),
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
  contact_phone: "",
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

/**
 * 저장된 배차 행 → 폼 값 (수정 화면·복사 등록 공용).
 * 선택 숫자 필드(운임·파렛·중량)는 null을 그대로 유지한다 — undefined로 바꾸면 RHF가
 * defaultValues로 되돌리는 문제가 다시 생긴다(위 pallet_count 주석 참고).
 *
 * @param clientName 거래처명 (dispatches에는 이름이 없어 clients에서 따로 조회해 넘긴다)
 */
export function dispatchRowToFormValues(
  row: DispatchRow,
  clientName: string
): DispatchFormValues {
  return {
    dispatch_date: row.dispatch_date,
    client_id: row.client_id ?? "",
    client_name: clientName,
    contact_name: row.contact_name ?? "",
    contact_phone: row.contact_phone ?? "",
    origin: row.origin,
    destination: row.destination,
    dropoff_type: row.dropoff_type,
    cargo_box_type: row.cargo_box_type ?? "",
    pallet_count: row.pallet_count,
    weight_ton: row.weight_ton,
    vehicle_id: row.vehicle_id ?? "",
    plate_no_snapshot: row.plate_no_snapshot ?? "",
    driver_name_snapshot: row.driver_name_snapshot ?? "",
    driver_phone_snapshot: row.driver_phone_snapshot ?? "",
    freight_amount: row.freight_amount,
    fee_amount: row.fee_amount,
    memo: row.memo ?? "",
  }
}

/**
 * 이전 건 복사 등록(/dispatches/new?copy=id)의 기본값: 수정 화면과 같은 모든 필드
 * (거래처·담당자·담당자 연락처·구간·하차일·차종·파렛/중량·차량 스냅샷·운임/수수료·비고)를 가져오고
 * 운송일자만 오늘로 바꾼다.
 *
 * @param clientName 복사할 거래처의 이름. 거래처가 삭제됐거나 없으면 null —
 *   삭제된 거래처로 새 배차가 만들어지지 않도록 거래처를 비운다.
 * @param isVehicleActive 원본의 vehicle_id가 아직 삭제되지 않은 등록 차량인지.
 *   false면 vehicle_id만 비우고 차량번호·기사명·연락처 스냅샷은 그대로 둔다.
 */
export function buildDispatchCopyDefaults(
  row: DispatchRow,
  options: { today: string; clientName: string | null; isVehicleActive: boolean }
): DispatchFormValues {
  const values = dispatchRowToFormValues(row, options.clientName ?? "")
  return {
    ...values,
    dispatch_date: options.today,
    client_id: options.clientName === null ? "" : values.client_id,
    vehicle_id: options.isVehicleActive ? values.vehicle_id : "",
  }
}

/**
 * 배차 폼 값 → 서버 액션(createDispatchAction/updateDispatchAction)에 넘길 FormData.
 * 서버에서는 coerceDispatchFormData가 이 문자열들을 다시 숫자/불리언으로 되돌린다.
 * (폼 컴포넌트에서 그대로 옮겨 온 함수 — 폼과 테스트가 같은 함수를 쓰도록 export)
 */
export function buildDispatchFormData(values: DispatchFormValues): FormData {
  const fd = new FormData()
  Object.entries(values).forEach(([key, value]) => {
    // null/undefined(미입력)는 아예 전송하지 않는다 — String(null)이 "null"이라는
    // 문자열로 직렬화되어 서버에서 NaN이 되는 것을 막는다.
    // 서버의 coerceDispatchFormData가 "전송되지 않음"을 null로 되돌린다.
    if (value === undefined || value === null) return
    fd.set(key, String(value))
  })
  return fd
}

/** FormData(문자열)를 서버에서 파싱하기 직전에 숫자/불리언으로 변환한다. */
export function coerceDispatchFormData(
  raw: Record<string, FormDataEntryValue>
): Record<string, unknown> {
  return {
    ...raw,
    // 선택 필드가 아예 전송되지 않은 경우(구버전 클라이언트 등)도 "미선택"으로 취급한다.
    cargo_box_type: raw.cargo_box_type ?? "",
    contact_phone: raw.contact_phone ?? "",
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
