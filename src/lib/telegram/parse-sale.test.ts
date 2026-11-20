import { describe, expect, it } from "vitest"

import {
  detectKind,
  normalizeLeadingDate,
  parseAmountToken,
  parseDateLine,
  parseSaleLines,
} from "@/lib/telegram/parse-sale"

const ctx = {
  today: "2026-11-14",
  sources: [
    { major: "거래처", sub: null },
    { major: "카카오톡", sub: null },
    { major: "카카오톡", sub: "스마일" },
    { major: "카카오톡", sub: "공항/사랑방" },
    { major: "지인", sub: null },
    { major: "24시콜화물", sub: null },
  ],
  clients: [
    { id: "c-woo", name: "우영로지스" },
    { id: "c-jo", name: "조은물류" },
    { id: "c-a1", name: "아토무역" },
    { id: "c-a2", name: "아토상사" },
  ],
}

describe("detectKind", () => {
  it("첫 줄 종류와 줄임말을 알아본다", () => {
    expect(detectKind("매출")).toBe("sale")
    expect(detectKind(" 매 ")).toBe("sale")
    expect(detectKind("지")).toBe("expense")
    expect(detectKind("배차")).toBe("dispatch")
    expect(detectKind("ㅁㅊ")).toBe("sale")
    expect(detectKind("ㅈㅊ")).toBe("expense")
    expect(detectKind(" ㅂㅊ")).toBe("dispatch")
    expect(detectKind("피셔")).toBeNull()
  })
})

describe("parseAmountToken", () => {
  it.each([
    ["75만", 750_000],
    ["75만원", 750_000],
    ["1.5만", 15_000],
    ["750,000", 750_000],
    ["5천", 5_000],
    ["120000원", 120_000],
  ])("%s → %d", (token, expected) => {
    expect(parseAmountToken(token)).toBe(expected)
  })

  it("금액이 아니면 null", () => {
    expect(parseAmountToken("1.5")).toBeNull()
    expect(parseAmountToken("부산대")).toBeNull()
    expect(parseAmountToken("75만부산")).toBeNull()
  })
})

describe("parseDateLine", () => {
  it.each([
    ["오늘", "2026-11-14"],
    ["어제", "2026-11-13"],
    ["그제", "2026-11-12"],
    ["11/3", "2026-11-03"],
    ["11월 2일", "2026-11-02"],
    ["11/14(금)", "2026-11-14"],
    ["2025-12-31", "2025-12-31"],
  ])("%s → %s", (line, expected) => {
    expect(parseDateLine(line, "2026-11-14")).toBe(expected)
  })

  it("1월 초에 12월 날짜를 쓰면 작년", () => {
    expect(parseDateLine("12/30", "2027-01-02")).toBe("2026-12-30")
  })

  it("없는 날짜·날짜가 아닌 줄은 null", () => {
    expect(parseDateLine("2/30", "2026-11-14")).toBeNull()
    // "1.6"은 무게(1.6톤)로 쓰므로 점 날짜는 받지 않는다
    expect(parseDateLine("1.6", "2026-11-14")).toBeNull()
    expect(parseDateLine("피셔", "2026-11-14")).toBeNull()
  })
})

describe("parseSaleLines", () => {
  it("사용자 예시: 금액 → 상차지 → 하차지 → 거래처 줄임말", () => {
    const r = parseSaleLines(["75만", "피셔", "칠곡경북대,부산대", "우영"], ctx)
    expect(r).toEqual({
      ok: true,
      value: {
        sale_date: "2026-11-14",
        origin: "피셔",
        destination: "칠곡경북대,부산대",
        supply_amount: 750_000,
        payment_method: "TAX_INVOICE",
        source_major: "거래처",
        source_sub: null,
        source_minor: "우영로지스",
        client_id: "c-woo",
        billing_entity_name: "우영로지스",
        memo: null,
        cargo_note: null,
        weight_ton: null,
        contact_name: null,
      },
    })
  })

  it("카톡,스마일,오더자 + 날짜 + 지불방법", () => {
    const r = parseSaleLines(["어제", "피셔", "부산", "30만 현금", "카톡,스마일,김재천"], ctx)
    expect(r.ok && r.value).toMatchObject({
      sale_date: "2026-11-13",
      supply_amount: 300_000,
      payment_method: "CASH",
      source_major: "카카오톡",
      source_sub: "스마일",
      source_minor: "김재천",
      client_id: null,
    })
  })

  it("하위분류가 아니면 둘째 칸은 오더자", () => {
    const r = parseSaleLines(["10만", "a", "b", "카톡,홍길동"], ctx)
    expect(r.ok && r.value).toMatchObject({ source_major: "카카오톡", source_sub: null, source_minor: "홍길동" })
  })

  it("지불방법만 따로 한 줄에 써도 된다", () => {
    const r = parseSaleLines(["10만", "이체", "a", "b"], ctx)
    expect(r.ok && r.value.payment_method).toBe("TRANSFER")
  })

  it("세 번째 장소 줄부터는 비고", () => {
    const r = parseSaleLines(["10만", "a", "b", "파레트 2개"], ctx)
    expect(r.ok && r.value.memo).toBe("파레트 2개")
  })

  it("출처 없이도 등록된다", () => {
    const r = parseSaleLines(["10만", "a", "b"], ctx)
    expect(r.ok && r.value.source_major).toBeNull()
  })

  it("금액이 없거나 장소가 하나면 되묻는다", () => {
    expect(parseSaleLines(["피셔", "부산"], ctx).ok).toBe(false)
    expect(parseSaleLines(["10만", "피셔"], ctx).ok).toBe(false)
    expect(parseSaleLines(["10만", "20만", "a", "b"], ctx).ok).toBe(false)
  })

  it("거래처 줄임말이 여러 곳에 맞으면 되묻는다", () => {
    const r = parseSaleLines(["10만", "a", "b", "아토"], ctx)
    expect(r.ok).toBe(false)
  })

  it("사용자 규칙: 출처 '지인,마상구' + 계산서 '세금 주주부린물류'", () => {
    const r = parseSaleLines(
      ["24만", "부산 바른씨", "안성 동원물류", "지인,마상구", "세금 주주부린물류"],
      ctx
    )
    expect(r.ok && r.value).toMatchObject({
      origin: "부산 바른씨",
      destination: "안성 동원물류",
      supply_amount: 240_000,
      payment_method: "TAX_INVOICE",
      source_major: "지인",
      source_minor: "마상구",
      client_id: null,
      billing_entity_name: "주주부린물류",
      memo: null,
    })
  })

  it("계산서 줄은 순서와 상관없고 '계산서:'도 된다, '세금'만 쓰면 지불방법만", () => {
    const r = parseSaleLines(["계산서: 주주부린물류", "24만", "a", "b"], ctx)
    expect(r.ok && r.value.billing_entity_name).toBe("주주부린물류")
    const onlyWord = parseSaleLines(["24만 세금", "a", "b"], ctx)
    expect(onlyWord.ok && onlyWord.value).toMatchObject({ payment_method: "TAX_INVOICE", billing_entity_name: null })
  })

  it("사업자 정보를 거래처 앞글자로 쓰면 전체 이름으로 바꾼다", () => {
    const r = parseSaleLines(["10만", "a", "b", "지인,마상구", "세금 조은"], ctx)
    expect(r.ok && r.value.billing_entity_name).toBe("조은물류")
  })
})

describe("normalizeLeadingDate (첫 줄 숫자 날짜)", () => {
  it.each([
    ["1123", "11/23"],
    ["923", "9/23"],
    ["11 23", "11/23"],
    ["11.23", "11/23"],
    ["11,23", "11/23"],
    ["0105", "1/5"],
  ])("%s → %s", (input, want) => {
    expect(normalizeLeadingDate([input, "75만"])).toEqual([want, "75만"])
  })
  it("날짜가 아니거나 첫 줄이 아니면 그대로", () => {
    expect(normalizeLeadingDate(["1340", "피셔"])).toEqual(["1340", "피셔"])
    expect(normalizeLeadingDate(["75만", "1123"])).toEqual(["75만", "1123"])
    expect(normalizeLeadingDate(["33"])).toEqual(["33"])
    expect(normalizeLeadingDate([])).toEqual([])
  })
})

describe("매출 물량·중량(냉동3·1.0)", () => {
  it("냉동3은 물량, 1.0은 중량 — 금액으로 읽지 않는다", () => {
    const r = parseSaleLines(["11/23", "부산3곳", "남양주 케이푸드", "40만", "냉동3", "1.0", "우영"], ctx)
    expect(
      r.ok && [r.value.supply_amount, r.value.origin, r.value.destination, r.value.cargo_note, r.value.weight_ton, r.value.memo]
    ).toEqual([400_000, "부산3곳", "남양주 케이푸드", "냉동3p", 1, null])
  })
  it("'냉동 3, 1.0' 한 줄도 물량·중량", () => {
    const r = parseSaleLines(["부산3곳", "남양주", "40만", "냉동 3, 1.0"], ctx)
    expect(r.ok && [r.value.cargo_note, r.value.weight_ton]).toEqual(["냉동3p", 1])
  })
})

describe("매출: 띄어 쓴 거래처 줄(배차 모양)", () => {
  it("'우영 김부장'은 거래처 우영로지스 · 담당자 김부장", () => {
    const r = parseSaleLines(["부산3곳", "남양주 케이푸드", "40만", "냉동3", "우영 김부장"], ctx)
    expect(
      r.ok && [r.value.client_id !== null, r.value.source_minor, r.value.destination, r.value.contact_name, r.value.memo]
    ).toEqual([true, "우영로지스", "남양주 케이푸드", "김부장", null])
  })
  it("장소가 두 줄뿐이면 장소를 거래처로 빼지 않는다", () => {
    const r = parseSaleLines(["우영 창고", "부산대", "40만"], ctx)
    expect(r.ok && [r.value.origin, r.value.client_id]).toEqual(["우영 창고", null])
  })
})
