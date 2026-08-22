import { describe, expect, it } from "vitest"

import {
  coerceDispatchFormData,
  dispatchFormDefaults,
  dispatchFormSchema,
} from "./dispatch"

/**
 * 선택 입력 숫자 필드(운임/파렛수량/중량)의 "미입력" 회귀 테스트.
 *
 * 배경: 이 필드들의 미입력을 undefined로 표현하던 시절, react-hook-form의
 * useController가 값이 undefined면 defaultValues로 되돌리는 탓에 수정 폼에서
 * 값을 지우면 "입력란엔 기존 값이 그대로 보이는데 저장은 null"로 되는
 * 화면-저장값 불일치가 있었다. 미입력은 null로 표현해야 한다.
 */

/** 폼의 buildFormData와 동일하게 null/undefined 필드를 제외해 FormData를 만든다. */
function buildFormDataLikeForm(
  values: Record<string, unknown>
): Record<string, FormDataEntryValue> {
  const fd = new FormData()
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    fd.set(key, String(value))
  })
  return Object.fromEntries(fd) as Record<string, FormDataEntryValue>
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
      coerceDispatchFormData(buildFormDataLikeForm(cleared))
    )

    expect(parsed.freight_amount).toBeNull()
    expect(parsed.pallet_count).toBeNull()
    expect(parsed.weight_ton).toBeNull()
  })

  it("0은 미입력과 구분되어 그대로 보존된다", () => {
    const withZero = { ...validBase, freight_amount: 0, pallet_count: 0 }

    const parsed = dispatchFormSchema.parse(
      coerceDispatchFormData(buildFormDataLikeForm(withZero))
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
      coerceDispatchFormData(buildFormDataLikeForm(filled))
    )

    expect(parsed.freight_amount).toBe(550000)
    expect(parsed.pallet_count).toBe(12)
    expect(parsed.weight_ton).toBe(5.5)
    expect(parsed.fee_amount).toBe(30000)
  })

  it("수수료는 NOT NULL이므로 미전송 시 0으로 채워진다", () => {
    const parsed = dispatchFormSchema.parse(
      coerceDispatchFormData(buildFormDataLikeForm(validBase))
    )

    expect(parsed.fee_amount).toBe(0)
  })
})
