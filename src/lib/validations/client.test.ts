import { describe, expect, it } from "vitest"

import { clientFormDefaults, clientFormSchema } from "./client"

/** 폼이 실제로 보내는 형태(모두 문자열)를 서버 액션처럼 파싱한다. */
function parse(overrides: Record<string, string> = {}) {
  return clientFormSchema.safeParse({
    ...clientFormDefaults,
    name: "우영로지스",
    ...overrides,
  })
}

describe("clientFormSchema", () => {
  it("거래처명만 있으면 저장할 수 있다 (나머지는 모두 선택)", () => {
    const parsed = parse()
    expect(parsed.success).toBe(true)
  })

  it("거래처명이 비면 거래처명 안내 문구로 거부한다", () => {
    const parsed = parse({ name: "   " })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("거래처명을 입력하세요")
    }
  })

  it("구분은 내 거래처(MINE)·타 거래처(OTHER)만 허용하고 기본값은 MINE이다", () => {
    expect(clientFormDefaults.category).toBe("MINE")
    expect(parse({ category: "MINE" }).success).toBe(true)
    expect(parse({ category: "OTHER" }).success).toBe(true)
    expect(parse({ category: "" }).success).toBe(false)
    expect(parse({ category: "mine" }).success).toBe(false)
    expect(parse({ category: "BOGUS" }).success).toBe(false)
  })

  it("사업자번호는 비워 두거나 체크섬이 맞아야 하고, 하이픈은 지워서 저장한다", () => {
    expect(parse({ biz_no: "" }).success).toBe(true)
    expect(parse({ biz_no: "1234567890" }).success).toBe(false)

    const valid = parse({ biz_no: "220-81-62517" })
    expect(valid.success).toBe(true)
    if (valid.success) expect(valid.data.biz_no).toBe("2208162517")
  })

  it("수신 이메일은 비워 두거나 형식이 맞아야 한다", () => {
    expect(parse({ contact_email: "" }).success).toBe(true)
    expect(parse({ contact_email: "tax@example.com" }).success).toBe(true)
    expect(parse({ contact_email: "not-an-email" }).success).toBe(false)
  })

  it("앞뒤 공백은 지운다", () => {
    const parsed = parse({
      name: "  조은푸드  ",
      contact_name: " 김과장 ",
      contact_phone: " 010-1111-2222 ",
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.name).toBe("조은푸드")
      expect(parsed.data.contact_name).toBe("김과장")
      expect(parsed.data.contact_phone).toBe("010-1111-2222")
    }
  })
})
