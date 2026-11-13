import { describe, expect, it } from "vitest"

import type { SaleRow } from "@/lib/supabase/database.types"

import {
  buildSaleCopyDefaults,
  buildSaleFormData,
  coerceSaleFormData,
  resolveSaleClientId,
  resolveSaleSourceSub,
  saleFormDefaults,
  saleFormSchema,
  saleRowToFormValues,
  type SaleFormValues,
} from "./sales"

const CLIENT_ID = "12956745-839d-4d78-b02e-1ea9363d3c35"

const baseRow: SaleRow = {
  id: "11111111-1111-1111-1111-111111111111",
  created_at: "2026-11-01T01:00:00+00:00",
  updated_at: null,
  deleted_at: null,
  sale_date: "2026-11-01",
  origin: "서울",
  destination: "부산",
  supply_amount: 100000,
  vat_amount: 10000,
  total_amount: 110000,
  is_vat_exempt: false,
  payment_method: "TRANSFER",
  payment_status: "PAID",
  paid_at: "2026-11-02",
  source_major: "거래처",
  source_sub: null,
  source_minor: "조은물류",
  source_note: "월말 정산",
  billing_entity_name: "조은물류(주)",
  order_contact_phone: "010-1234-5678",
  client_id: CLIENT_ID,
  memo: "냉동",
}

/**
 * 폼이 실제로 쓰는 buildSaleFormData로 FormData를 만들고, 서버 액션과 똑같이
 * Object.fromEntries로 펼친다.
 */
function submittedEntries(
  values: SaleFormValues
): Record<string, FormDataEntryValue> {
  return Object.fromEntries(buildSaleFormData(values)) as Record<
    string,
    FormDataEntryValue
  >
}

describe("saleRowToFormValues", () => {
  it("nullable text는 빈 문자열로 바꾼다", () => {
    const values = saleRowToFormValues({
      ...baseRow,
      source_major: null,
      source_minor: null,
      source_note: null,
      billing_entity_name: null,
      order_contact_phone: null,
      client_id: null,
      memo: null,
    })

    expect(values.source_major).toBe("")
    expect(values.source_minor).toBe("")
    expect(values.source_note).toBe("")
    expect(values.billing_entity_name).toBe("")
    expect(values.order_contact_phone).toBe("")
    expect(values.client_id).toBe("")
    expect(values.memo).toBe("")
  })
})

describe("buildSaleCopyDefaults (이전 건 복사)", () => {
  it("폼의 모든 필드를 가져오고 매출일자만 오늘로 바꾼다", () => {
    const copied = buildSaleCopyDefaults(baseRow, "2026-11-08")

    expect(copied).toEqual({
      sale_date: "2026-11-08",
      origin: "서울",
      destination: "부산",
      supply_amount: 100000,
      // 저장된 값(false)이 아니라 지불방법(계좌이체 → 세액 없음)에서 다시 정해진다.
      is_vat_exempt: true,
      payment_method: "TRANSFER",
      source_major: "거래처",
      source_sub: "",
      source_minor: "조은물류",
      source_note: "월말 정산",
      billing_entity_name: "조은물류(주)",
      order_contact_phone: "010-1234-5678",
      client_id: CLIENT_ID,
      memo: "냉동",
    })
  })

  it("입금 상태·부가세·합계 등 폼 밖의 값은 복사하지 않는다 (RPC가 다시 계산)", () => {
    const copied = buildSaleCopyDefaults(baseRow, "2026-11-08")

    expect(copied).not.toHaveProperty("payment_status")
    expect(copied).not.toHaveProperty("paid_at")
    expect(copied).not.toHaveProperty("vat_amount")
    expect(copied).not.toHaveProperty("total_amount")
    expect(copied).not.toHaveProperty("id")
  })

  it("현금(is_vat_exempt)도 그대로 복사된다", () => {
    const copied = buildSaleCopyDefaults(
      { ...baseRow, is_vat_exempt: true, payment_method: "CASH" },
      "2026-11-08"
    )
    expect(copied.is_vat_exempt).toBe(true)
    expect(copied.payment_method).toBe("CASH")
  })

  it("복사한 값은 그대로 서버 검증을 통과한다", () => {
    const copied = buildSaleCopyDefaults(baseRow, "2026-11-08")
    const parsed = saleFormSchema.safeParse(
      coerceSaleFormData(submittedEntries(copied))
    )
    expect(parsed.success).toBe(true)
  })
})

describe("세액 규칙: 지불방법이 세금계산서일 때만 세액 있음 (현금 체크박스 없음)", () => {
  const methods = ["TAX_INVOICE", "TRANSFER", "CASH"] as const
  const expectedExempt = { TAX_INVOICE: false, TRANSFER: true, CASH: true }

  it("수정·복사 화면 값은 저장된 is_vat_exempt가 아니라 지불방법에서 정해진다", () => {
    for (const method of methods) {
      for (const stored of [true, false]) {
        const values = saleRowToFormValues({
          ...baseRow,
          payment_method: method,
          is_vat_exempt: stored,
        })
        expect(values.is_vat_exempt).toBe(expectedExempt[method])
      }
    }
  })

  it("폼 상태의 is_vat_exempt가 어긋나 있어도 FormData는 지불방법 기준으로 보낸다", () => {
    for (const method of methods) {
      for (const stale of [true, false]) {
        const fd = buildSaleFormData({
          ...saleRowToFormValues(baseRow),
          payment_method: method,
          is_vat_exempt: stale,
        })
        expect(fd.get("is_vat_exempt")).toBe(String(expectedExempt[method]))
      }
    }
  })

  it("서버는 클라이언트가 보낸 is_vat_exempt를 믿지 않고 지불방법으로 다시 정한다", () => {
    for (const method of methods) {
      for (const posted of ["true", "false", "", "1", "yes"]) {
        const coerced = coerceSaleFormData({
          ...submittedEntries(saleRowToFormValues(baseRow)),
          payment_method: method,
          is_vat_exempt: posted,
        })
        expect(coerced.is_vat_exempt).toBe(expectedExempt[method])
      }
    }
  })

  it("is_vat_exempt를 아예 안 보내거나 위조해도 세액은 지불방법대로다 (세금계산서 건을 면세로 위조 불가)", () => {
    const entries = submittedEntries({
      ...saleRowToFormValues(baseRow),
      payment_method: "TAX_INVOICE",
    })
    delete entries.is_vat_exempt
    expect(
      saleFormSchema.parse(coerceSaleFormData(entries)).is_vat_exempt
    ).toBe(false)

    const forged = saleFormSchema.parse(
      coerceSaleFormData({ ...entries, is_vat_exempt: "true" })
    )
    expect(forged.is_vat_exempt).toBe(false)
  })

  it("알 수 없는 지불방법은 검증에서 거부된다", () => {
    const parsed = saleFormSchema.safeParse(
      coerceSaleFormData({
        ...submittedEntries(saleRowToFormValues(baseRow)),
        payment_method: "BOGUS",
      })
    )
    expect(parsed.success).toBe(false)
  })

  it("저장까지의 흐름: 폼 값 → FormData → 서버 파싱 결과가 지불방법별 RPC 인자와 같다", () => {
    for (const method of methods) {
      const parsed = saleFormSchema.parse(
        coerceSaleFormData(
          submittedEntries({
            ...saleRowToFormValues(baseRow),
            payment_method: method,
            supply_amount: 550000,
          })
        )
      )
      expect(parsed.payment_method).toBe(method)
      expect(parsed.is_vat_exempt).toBe(expectedExempt[method])
    }
  })
})

describe("거래처 연결(client_id)", () => {
  it("기본값은 연결 없음이고, 저장된 행의 연결을 폼 값으로 가져온다", () => {
    expect(saleFormDefaults.client_id).toBe("")
    expect(saleRowToFormValues(baseRow).client_id).toBe(CLIENT_ID)
    expect(saleRowToFormValues({ ...baseRow, client_id: null }).client_id).toBe("")
  })

  it("복사 등록은 거래처 연결도 그대로 가져온다", () => {
    expect(buildSaleCopyDefaults(baseRow, "2026-11-08").client_id).toBe(CLIENT_ID)
  })

  it("검증: 빈 값이거나 uuid여야 한다", () => {
    const parse = (client_id: string) =>
      saleFormSchema.safeParse({
        ...saleRowToFormValues(baseRow),
        client_id,
      })

    expect(parse("").success).toBe(true)
    expect(parse(CLIENT_ID).success).toBe(true)
    expect(parse("not-a-uuid").success).toBe(false)
    expect(parse("12956745").success).toBe(false)
  })

  it("폼 값 → FormData → 서버 파싱 후에도 연결이 그대로다", () => {
    const parsed = saleFormSchema.parse(
      coerceSaleFormData(submittedEntries(saleRowToFormValues(baseRow)))
    )
    expect(parsed.client_id).toBe(CLIENT_ID)
  })

  it("client_id가 아예 안 와도(구버전 클라이언트) 연결 없음으로 본다", () => {
    const entries = submittedEntries(saleRowToFormValues(baseRow))
    delete entries.client_id
    expect(saleFormSchema.parse(coerceSaleFormData(entries)).client_id).toBe("")
  })

  it("resolveSaleClientId: 출처가 거래처일 때만 연결을 RPC로 넘긴다", () => {
    expect(
      resolveSaleClientId({ source_major: "거래처", client_id: CLIENT_ID })
    ).toBe(CLIENT_ID)

    // 다른 출처로 바꾸고 저장해도 이전에 고른 거래처 연결이 남지 않는다.
    for (const major of ["", "지인", "카카오톡", "밴드", "24시콜화물", "기타"]) {
      expect(
        resolveSaleClientId({ source_major: major, client_id: CLIENT_ID })
      ).toBeNull()
    }

    // 거래처인데 연결이 없으면(이름만 적은 예전 건) null
    expect(
      resolveSaleClientId({ source_major: "거래처", client_id: "" })
    ).toBeNull()
  })
})

describe("buildSaleFormData (폼 → 서버 액션 직렬화)", () => {
  it("숫자·불리언을 문자열로 보내고 서버 coerce가 되돌린다", () => {
    const values = {
      ...saleRowToFormValues(baseRow),
      supply_amount: 550000,
      is_vat_exempt: true,
    }
    const fd = buildSaleFormData(values)

    expect(fd.get("supply_amount")).toBe("550000")
    expect(fd.get("is_vat_exempt")).toBe("true")
    expect(saleFormSchema.parse(coerceSaleFormData(submittedEntries(values)))).toEqual(values)
  })
})

describe("resolveSaleSourceSub", () => {
  it("출처가 있고 거래처가 아니면 하위분류를 넘긴다", () => {
    expect(resolveSaleSourceSub({ source_major: "카카오톡", source_sub: "스마일" })).toBe("스마일")
  })

  it("하위분류가 비었거나, 출처가 없거나, 거래처면 null", () => {
    expect(resolveSaleSourceSub({ source_major: "카카오톡", source_sub: "" })).toBeNull()
    expect(resolveSaleSourceSub({ source_major: "", source_sub: "스마일" })).toBeNull()
    expect(resolveSaleSourceSub({ source_major: "거래처", source_sub: "스마일" })).toBeNull()
  })
})
