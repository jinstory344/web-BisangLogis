import { describe, expect, it } from "vitest"

import {
  parseCargoLine,
  parseDispatchLines,
  parseWeightLine,
} from "@/lib/telegram/parse-dispatch"
import { parseExpenseLines } from "@/lib/telegram/parse-expense"

const today = "2026-11-14"
const clients = [
  { id: "c-ato", name: "아토무역" },
  { id: "c-woo", name: "우영로지스" },
]
const vehicles = [
  { id: "v-1", plate_no: "서울86바7754", driver_name: "김진승", driver_phone: "010-1111-2222" },
]

describe("parseDispatchLines", () => {
  it("사용자 예시를 그대로 알아본다", () => {
    const r = parseDispatchLines(
      ["부산2곳", "현대그린", "익착", "33만", "아토무역 이재근", "서울86바7754 김진승", "냉동3", "1.6"],
      { today, clients, vehicles }
    )
    expect(r).toEqual({
      ok: true,
      value: {
        dispatch_date: today,
        client_id: "c-ato",
        client_name: "아토무역",
        contact_name: "이재근",
        contact_phone: null,
        origin: "부산2곳",
        destination: "현대그린",
        dropoff_type: "NEXT_DAY",
        pallet_count: 3,
        weight_ton: 1.6,
        cargo_box_type: "REFRIGERATED",
        vehicle_id: "v-1",
        plate_no_snapshot: "서울86바7754",
        driver_name_snapshot: "김진승",
        driver_phone_snapshot: "010-1111-2222",
        freight_amount: 330_000,
        fee_amount: 0,
        memo: null,
      },
    })
  })

  it("하차일 기본은 당착, 수수료는 '수2만', 모르는 차량은 적은 그대로", () => {
    const r = parseDispatchLines(
      ["a", "b", "아토", "수2만", "12가3456 홍길동 010-3333-4444", "윙"],
      { today, clients, vehicles }
    )
    expect(r.ok && r.value).toMatchObject({
      dropoff_type: "SAME_DAY",
      fee_amount: 20_000,
      freight_amount: null,
      vehicle_id: null,
      plate_no_snapshot: "12가3456",
      driver_name_snapshot: "홍길동",
      driver_phone_snapshot: "010-3333-4444",
      cargo_box_type: "WING",
      pallet_count: null,
      contact_name: null,
    })
  })

  it("담당자·차주 이름 뒤에 연락처를 쓰면 둘 다 들어간다", () => {
    const r = parseDispatchLines(
      ["a", "b", "아토무역 이재근 010-1234-5678", "서울86바7754 김진승 01098765432"],
      { today, clients, vehicles }
    )
    expect(r.ok && r.value).toMatchObject({
      contact_name: "이재근",
      contact_phone: "010-1234-5678",
      driver_name_snapshot: "김진승",
      driver_phone_snapshot: "01098765432",
    })
  })

  it("거래처가 없거나 장소가 하나면 되묻는다", () => {
    expect(parseDispatchLines(["a", "b", "33만"], { today, clients, vehicles }).ok).toBe(false)
    expect(parseDispatchLines(["a", "아토무역"], { today, clients, vehicles }).ok).toBe(false)
  })

  it("운임이 두 번이면 되묻는다", () => {
    expect(parseDispatchLines(["a", "b", "아토무역", "33만", "2만"], { today, clients, vehicles }).ok).toBe(false)
  })
})

describe("parseCargoLine / parseWeightLine", () => {
  it("차종 줄임말과 파레트 수", () => {
    expect(parseCargoLine("냉동3")).toEqual({ type: "REFRIGERATED", pallets: 3 })
    expect(parseCargoLine("냉장")).toEqual({ type: "WING", pallets: null })
    expect(parseCargoLine("탑 10")).toEqual({ type: "BOX", pallets: 10 })
    expect(parseCargoLine("카고")).toEqual({ type: "CARGO", pallets: null })
    expect(parseCargoLine("현대그린")).toBeNull()
  })

  it("무게", () => {
    expect(parseWeightLine("1.6")).toBe(1.6)
    expect(parseWeightLine("5톤")).toBe(5)
    expect(parseWeightLine("3")).toBe(3)
    expect(parseWeightLine("330000")).toBeNull()
  })
})

describe("parseExpenseLines", () => {
  const categories = [
    { major: "차량", minor: "주유비" },
    { major: "차량", minor: "주차" },
    { major: "생활", minor: "식비" },
    { major: "생활", minor: "주차" },
  ]

  it("금액·분류 앞글자, 결제방법 기본 카드", () => {
    const r = parseExpenseLines(["8만", "주유"], { today, categories })
    expect(r).toEqual({
      ok: true,
      value: {
        expense_date: today,
        category_major: "차량",
        category_minor: "주유비",
        amount: 80_000,
        payment_method: "CARD",
        memo: null,
      },
    })
  })

  it("결제방법·날짜·비고", () => {
    const r = parseExpenseLines(["어제", "식비 1.2만 현금", "점심"], { today, categories })
    // "식비 1.2만 현금"은 한 줄에 분류가 섞여 금액 줄이 아니므로 분류도 못 찾는다 → 되묻기
    expect(r.ok).toBe(false)
    const ok = parseExpenseLines(["어제", "1.2만 현금", "식비", "점심"], { today, categories })
    expect(ok.ok && ok.value).toMatchObject({
      expense_date: "2026-11-13",
      amount: 12_000,
      payment_method: "CASH",
      category_minor: "식비",
      memo: "점심",
    })
  })

  it("같은 이름의 소분류가 여러 대분류에 있으면 '대분류,소분류'로 고른다", () => {
    expect(parseExpenseLines(["1만", "주차"], { today, categories }).ok).toBe(false)
    const r = parseExpenseLines(["1만", "차량,주차"], { today, categories })
    expect(r.ok && r.value.category_major).toBe("차량")
  })

  it("분류가 없으면 되묻는다", () => {
    expect(parseExpenseLines(["1만", "모르는거"], { today, categories }).ok).toBe(false)
  })
})
