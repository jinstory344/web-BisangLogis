import { describe, expect, it } from "vitest"

import {
  findVehicle,
  parseCargoLine,
  parseLoadLine,
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
        pallet_count: null,
        weight_ton: 1.6,
        cargo_box_type: null,
        cargo_note: "냉동3p",
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

describe("findVehicle", () => {
  it("지역 이름을 빼고 써도 등록 차량을 찾는다", () => {
    expect(findVehicle(vehicles, "86바7754")?.id).toBe("v-1")
    expect(findVehicle(vehicles, "서울 86바 7754")?.id).toBe("v-1")
    expect(findVehicle(vehicles, "12가3456")).toBeUndefined()
  })
})

describe("parseLoadLine (물량)", () => {
  it("냉동·냉장 + 파레트 수(+톤)는 물량", () => {
    expect(parseLoadLine("냉동3")).toEqual({ note: "냉동3p", weight: null })
    expect(parseLoadLine("냉동 3, 1.3")).toEqual({ note: "냉동3p", weight: 1.3 })
    expect(parseLoadLine("냉장 2p 1.5톤")).toEqual({ note: "냉장2p", weight: 1.5 })
    expect(parseLoadLine("냉장")).toEqual({ note: "냉장", weight: null })
    expect(parseLoadLine("냉동탑")).toBeNull()
    expect(parseLoadLine("냉동창고")).toBeNull()
  })

  it("봇 메시지의 '냉동 3, 1.3'은 차종이 아니라 물량·중량", () => {
    const r = parseDispatchLines(["a", "b", "아토무역", "냉동 3, 1.3"], { today, clients, vehicles })
    expect(r.ok && r.value).toMatchObject({ cargo_note: "냉동3p", weight_ton: 1.3, cargo_box_type: null, pallet_count: null })
  })
})

describe("parseCargoLine / parseWeightLine", () => {
  it("차종 줄임말과 파레트 수", () => {
    expect(parseCargoLine("냉동탑3")).toEqual({ type: "REFRIGERATED", pallets: 3 })
    expect(parseCargoLine("냉장윙")).toEqual({ type: "WING", pallets: null })
    expect(parseCargoLine("냉동3")).toBeNull()
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
        installment_months: null,
        card_name: null,
        liters: null,
        memo: null,
      },
    })
  })

  it("리터: 금액 뒤 쉼표+숫자 또는 50L, 주유비·요소수만", () => {
    for (const line of ["8만,50", "8만, 50", "8만,50L", "8만 50리터", "80000,50"]) {
      const r = parseExpenseLines([line, "주유"], { today, categories })
      expect(r.ok && r.value).toMatchObject({ amount: 80_000, liters: 50 })
    }
    const decimal = parseExpenseLines(["12만,85.5 신한복지", "주유"], { today, categories, cards: ["신한복지"] })
    expect(decimal.ok && decimal.value).toMatchObject({ amount: 120_000, liters: 85.5, card_name: "신한복지" })
    // 사용자 예시: 금액(천 단위 쉼표)·리터·카드를 쉼표로 이어 쓰기
    const joined = parseExpenseLines(["주유", "74,331원,53,삼성복지"], { today, categories, cards: ["삼성복지"] })
    expect(joined.ok && joined.value).toMatchObject({
      amount: 74_331,
      liters: 53,
      card_name: "삼성복지",
      category_minor: "주유비",
      memo: null,
    })
    for (const line of ["74331,53,삼성복지", "74,331,53,삼성복지", "74,331원, 53L, 삼성복지"]) {
      const r = parseExpenseLines(["주유", line], { today, categories, cards: ["삼성복지"] })
      expect(r.ok && r.value).toMatchObject({ amount: 74_331, liters: 53, card_name: "삼성복지" })
    }
    const months = parseExpenseLines(["60만,6개월", "주유"], { today, categories })
    expect(months.ok && months.value).toMatchObject({ amount: 600_000, installment_months: 6, liters: null })
    // 천 단위 쉼표는 금액 그대로
    const thousands = parseExpenseLines(["80,000", "주유"], { today, categories })
    expect(thousands.ok && thousands.value).toMatchObject({ amount: 80_000, liters: null })
    // 주유비·요소수가 아니면 리터는 버린다
    const food = parseExpenseLines(["1만,5", "식비"], { today, categories })
    expect(food.ok && food.value).toMatchObject({ amount: 10_000, liters: null })
  })

  it("카드 이름: 금액 줄 안이나 따로 한 줄, 띄어쓰기·대소문자 무시", () => {
    const cards = ["신한복지", "신한RPM", "현대카드"]
    const inLine = parseExpenseLines(["8만 신한복지 3개월", "주유"], { today, categories, cards })
    expect(inLine.ok && inLine.value).toMatchObject({
      amount: 80_000,
      payment_method: "CARD",
      card_name: "신한복지",
      installment_months: 3,
    })
    const ownLine = parseExpenseLines(["8만", "신한 rpm", "주유"], { today, categories, cards })
    expect(ownLine.ok && ownLine.value).toMatchObject({ card_name: "신한RPM", memo: null })
    // "현대카드"는 결제 낱말 "카드"와 헷갈리지 않는다
    const hyundai = parseExpenseLines(["8만 현대카드", "주유"], { today, categories, cards })
    expect(hyundai.ok && hyundai.value).toMatchObject({ card_name: "현대카드" })
    expect(parseExpenseLines(["8만 현금 신한복지", "주유"], { today, categories, cards }).ok).toBe(false)
  })

  it("할부: 6개월 / 할부6 / 할부 6개월, 카드만, 2~12개월", () => {
    for (const line of ["60만 6개월", "60만 할부6", "60만 할부 6개월", "60만 카드 6개월할부"]) {
      const r = parseExpenseLines([line, "주유"], { today, categories })
      expect(r.ok && r.value).toMatchObject({ amount: 600_000, payment_method: "CARD", installment_months: 6 })
    }
    expect(parseExpenseLines(["60만 현금 6개월", "주유"], { today, categories }).ok).toBe(false)
    // 1개월·13개월은 할부로 보지 않아 금액 줄이 아니게 되고 → 비고로 간다
    const one = parseExpenseLines(["60만", "주유", "1개월"], { today, categories })
    expect(one.ok && one.value).toMatchObject({ installment_months: null, memo: "1개월" })
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

describe("배차 거래처: 묶음(조은푸드 육대장·이화수)", () => {
  const cs = [
    { id: "c-yuk", name: "조은푸드 육대장" },
    { id: "c-ihwa", name: "조은푸드 이화수" },
    { id: "c-mul", name: "조은물류" },
  ]
  const run = (clientLine: string, recentClientIds: string[] = []) =>
    parseDispatchLines(["인천남동 조은푸드", "광주 삼진냉장", "18만", clientLine], {
      today,
      clients: cs,
      vehicles,
      recentClientIds,
    })
  const pick = (r: ReturnType<typeof run>) => (r.ok ? [r.value.client_id, r.value.contact_name, r.value.origin] : r.error)

  it("'육대장'·'이화수'만 써도 된다", () => {
    expect(pick(run("육대장"))).toEqual(["c-yuk", null, "인천남동 조은푸드"])
    expect(pick(run("이화수 김부장"))).toEqual(["c-ihwa", "김부장", "인천남동 조은푸드"])
  })

  it("'조은푸드 육대장'은 두 단어로 고르고 나머지는 담당자", () => {
    expect(pick(run("조은푸드 육대장 김부장"))).toEqual(["c-yuk", "김부장", "인천남동 조은푸드"])
  })

  it("'조은푸드'만 쓰면 묶음 중 가장 최근에 배차한 곳", () => {
    expect(pick(run("조은푸드", ["c-mul", "c-ihwa", "c-yuk"]))).toEqual(["c-ihwa", null, "인천남동 조은푸드"])
  })

  it("최근 배차가 없거나 묶음이 아닌 여러 곳('조은')이면 다시 묻는다", () => {
    expect(run("조은푸드").ok).toBe(false)
    expect(run("조은", ["c-yuk"]).ok).toBe(false)
  })

  it("상차지가 '조은푸드'여도 끝 줄의 거래처를 쓴다", () => {
    const r = parseDispatchLines(["조은푸드", "광주 삼진냉장", "18만", "육대장"], {
      today,
      clients: cs,
      vehicles,
      recentClientIds: ["c-ihwa"],
    })
    expect(r.ok && [r.value.client_id, r.value.origin, r.value.destination]).toEqual([
      "c-yuk",
      "조은푸드",
      "광주 삼진냉장",
    ])
  })
})
