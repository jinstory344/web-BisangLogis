import { describe, expect, it } from "vitest"

import type { DispatchRow } from "@/lib/supabase/database.types"

import {
  buildDispatchCopyDefaults,
  buildDispatchFormData,
  coerceDispatchFormData,
  dispatchFormDefaults,
  dispatchFormSchema,
  dispatchRowToFormValues,
  type DispatchFormValues,
} from "./dispatch"

/**
 * 선택 입력 숫자 필드(운임/파렛수량/중량)의 "미입력" 회귀 테스트.
 *
 * 배경: 이 필드들의 미입력을 undefined로 표현하던 시절, react-hook-form의
 * useController가 값이 undefined면 defaultValues로 되돌리는 탓에 수정 폼에서
 * 값을 지우면 "입력란엔 기존 값이 그대로 보이는데 저장은 null"로 되는
 * 화면-저장값 불일치가 있었다. 미입력은 null로 표현해야 한다.
 */

/**
 * 폼(dispatch-form.tsx)이 실제로 쓰는 buildDispatchFormData로 FormData를 만들고,
 * 서버 액션과 똑같이 Object.fromEntries로 펼친다 (null/undefined 필드는 전송되지 않음).
 */
function submittedEntries(
  values: DispatchFormValues
): Record<string, FormDataEntryValue> {
  return Object.fromEntries(buildDispatchFormData(values)) as Record<
    string,
    FormDataEntryValue
  >
}

const validBase = {
  ...dispatchFormDefaults,
  dispatch_date: "2026-08-23",
  client_id: "11111111-1111-1111-1111-111111111111",
  client_name: "테스트 거래처",
  origin: "서울",
  destination: "부산",
}

describe("dispatchFormSchema - 선택 입력 숫자 필드", () => {
  it("기본값의 미입력 숫자 필드는 null이다 (undefined 아님)", () => {
    expect(dispatchFormDefaults.freight_amount).toBeNull()
    expect(dispatchFormDefaults.pallet_count).toBeNull()
    expect(dispatchFormDefaults.weight_ton).toBeNull()
  })

  it("값을 지운 채 제출하면 null로 파싱된다 (기존 값이 되살아나지 않는다)", () => {
    // 수정 폼에서 운임/파렛/중량을 모두 지운 상태
    const cleared = {
      ...validBase,
      freight_amount: null,
      pallet_count: null,
      weight_ton: null,
    }

    const parsed = dispatchFormSchema.parse(
      coerceDispatchFormData(submittedEntries(cleared))
    )

    expect(parsed.freight_amount).toBeNull()
    expect(parsed.pallet_count).toBeNull()
    expect(parsed.weight_ton).toBeNull()
  })

  it("0은 미입력과 구분되어 그대로 보존된다", () => {
    const withZero = { ...validBase, freight_amount: 0, pallet_count: 0 }

    const parsed = dispatchFormSchema.parse(
      coerceDispatchFormData(submittedEntries(withZero))
    )

    expect(parsed.freight_amount).toBe(0)
    expect(parsed.pallet_count).toBe(0)
  })

  it("입력된 값은 숫자로 변환된다", () => {
    const filled = {
      ...validBase,
      freight_amount: 550000,
      pallet_count: 12,
      weight_ton: 5.5,
      fee_amount: 30000,
    }

    const parsed = dispatchFormSchema.parse(
      coerceDispatchFormData(submittedEntries(filled))
    )

    expect(parsed.freight_amount).toBe(550000)
    expect(parsed.pallet_count).toBe(12)
    expect(parsed.weight_ton).toBe(5.5)
    expect(parsed.fee_amount).toBe(30000)
  })

  it("수수료는 NOT NULL이므로 미전송 시 0으로 채워진다", () => {
    const parsed = dispatchFormSchema.parse(
      coerceDispatchFormData(submittedEntries(validBase))
    )

    expect(parsed.fee_amount).toBe(0)
  })
})

const baseRow: DispatchRow = {
  id: "33333333-3333-3333-3333-333333333333",
  created_at: "2026-11-01T01:00:00+00:00",
  updated_at: null,
  deleted_at: null,
  dispatch_date: "2026-11-01",
  client_id: "11111111-1111-1111-1111-111111111111",
  contact_name: "박담당",
  contact_phone: "010-3333-4444",
  origin: "서울",
  destination: "부산",
  dropoff_type: "NEXT_DAY",
  pallet_count: 12,
  weight_ton: 5.5,
  cargo_box_type: "WING",
  vehicle_id: "44444444-4444-4444-4444-444444444444",
  plate_no_snapshot: "서울12가3456",
  driver_name_snapshot: "김기사",
  driver_phone_snapshot: "010-1111-2222",
  dispatcher_name: null,
  freight_amount: 550000,
  fee_amount: 30000,
  memo: "냉동소량",
}

describe("dispatchRowToFormValues (수정 화면)", () => {
  it("미입력 숫자 필드는 null 그대로 둔다 (undefined 금지)", () => {
    const values = dispatchRowToFormValues(
      {
        ...baseRow,
        freight_amount: null,
        pallet_count: null,
        weight_ton: null,
        cargo_box_type: null,
      },
      "테스트 거래처"
    )

    expect(values.freight_amount).toBeNull()
    expect(values.pallet_count).toBeNull()
    expect(values.weight_ton).toBeNull()
    expect(values.cargo_box_type).toBe("")
  })
})

describe("buildDispatchCopyDefaults (이전 건 복사)", () => {
  const options = {
    today: "2026-11-08",
    clientName: "테스트 거래처",
    isVehicleActive: true,
  }

  it("수정 화면과 같은 모든 필드를 가져오고 운송일자만 오늘로 바꾼다", () => {
    expect(buildDispatchCopyDefaults(baseRow, options)).toEqual({
      dispatch_date: "2026-11-08",
      client_id: "11111111-1111-1111-1111-111111111111",
      client_name: "테스트 거래처",
      contact_name: "박담당",
      contact_phone: "010-3333-4444",
      origin: "서울",
      destination: "부산",
      dropoff_type: "NEXT_DAY",
      cargo_box_type: "WING",
      pallet_count: 12,
      weight_ton: 5.5,
      vehicle_id: "44444444-4444-4444-4444-444444444444",
      plate_no_snapshot: "서울12가3456",
      driver_name_snapshot: "김기사",
      driver_phone_snapshot: "010-1111-2222",
      freight_amount: 550000,
      fee_amount: 30000,
      memo: "냉동소량",
    })
  })

  it("운임·파렛·중량 미입력(null)은 null로 복사된다", () => {
    const copied = buildDispatchCopyDefaults(
      { ...baseRow, freight_amount: null, pallet_count: null, weight_ton: null },
      options
    )
    expect(copied.freight_amount).toBeNull()
    expect(copied.pallet_count).toBeNull()
    expect(copied.weight_ton).toBeNull()
  })

  it("거래처가 삭제됐으면(clientName=null) 거래처를 비운다", () => {
    const copied = buildDispatchCopyDefaults(baseRow, {
      ...options,
      clientName: null,
    })
    expect(copied.client_id).toBe("")
    expect(copied.client_name).toBe("")
  })

  it("등록 차량이 삭제됐으면 vehicle_id만 비우고 스냅샷은 유지한다", () => {
    const copied = buildDispatchCopyDefaults(baseRow, {
      ...options,
      isVehicleActive: false,
    })
    expect(copied.vehicle_id).toBe("")
    expect(copied.plate_no_snapshot).toBe("서울12가3456")
    expect(copied.driver_name_snapshot).toBe("김기사")
    expect(copied.driver_phone_snapshot).toBe("010-1111-2222")
  })

  it("복사한 값은 그대로 서버 검증을 통과한다", () => {
    const copied = buildDispatchCopyDefaults(
      { ...baseRow, freight_amount: null, cargo_box_type: null },
      options
    )
    const parsed = dispatchFormSchema.parse(
      coerceDispatchFormData(submittedEntries(copied))
    )
    expect(parsed.dispatch_date).toBe("2026-11-08")
    expect(parsed.freight_amount).toBeNull()
    expect(parsed.cargo_box_type).toBe("")
    expect(parsed.fee_amount).toBe(30000)
  })
})

describe("담당자 연락처(contact_phone)", () => {
  it("기본값은 빈 문자열이고, 저장된 행의 값을 폼 값으로 가져온다 (null은 빈 문자열)", () => {
    expect(dispatchFormDefaults.contact_phone).toBe("")
    expect(dispatchRowToFormValues(baseRow, "거래처").contact_phone).toBe(
      "010-3333-4444"
    )
    expect(
      dispatchRowToFormValues({ ...baseRow, contact_phone: null }, "거래처")
        .contact_phone
    ).toBe("")
  })

  it("담당자 연락처와 기사 연락처는 서로 다른 필드로 따로 보존된다", () => {
    const copied = buildDispatchCopyDefaults(baseRow, {
      today: "2026-11-08",
      clientName: "거래처",
      isVehicleActive: true,
    })
    expect(copied.contact_phone).toBe("010-3333-4444")
    expect(copied.driver_phone_snapshot).toBe("010-1111-2222")
  })

  it("폼 값 → FormData → 서버 파싱 후에도 그대로이고, 앞뒤 공백은 지운다", () => {
    const parsed = dispatchFormSchema.parse(
      coerceDispatchFormData(
        submittedEntries({
          ...validBase,
          contact_name: "박담당",
          contact_phone: "  010-3333-4444 ",
        })
      )
    )
    expect(parsed.contact_name).toBe("박담당")
    expect(parsed.contact_phone).toBe("010-3333-4444")
  })

  it("contact_phone이 아예 안 와도(구버전 클라이언트) 빈 값으로 본다", () => {
    const entries = submittedEntries({ ...validBase })
    delete entries.contact_phone
    expect(
      dispatchFormSchema.parse(coerceDispatchFormData(entries)).contact_phone
    ).toBe("")
  })
})

describe("buildDispatchFormData (폼 → 서버 액션 직렬화)", () => {
  it("null/undefined 필드는 아예 전송하지 않고, 나머지는 문자열로 보낸다", () => {
    const fd = buildDispatchFormData({
      ...validBase,
      freight_amount: null,
      pallet_count: null,
      vehicle_id: undefined,
      fee_amount: 0,
      weight_ton: 5.5,
    })

    expect(fd.has("freight_amount")).toBe(false)
    expect(fd.has("pallet_count")).toBe(false)
    expect(fd.has("vehicle_id")).toBe(false)
    expect(fd.get("fee_amount")).toBe("0")
    expect(fd.get("weight_ton")).toBe("5.5")
    expect(fd.get("cargo_box_type")).toBe("")
  })
})
