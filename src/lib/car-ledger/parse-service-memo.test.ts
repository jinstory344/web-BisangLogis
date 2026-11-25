import { describe, expect, it } from "vitest"

import { parseServiceMemo } from "./parse-service-memo"

const names = (memo: string) => parseServiceMemo(memo).items.map((item) => item.name)

describe("parseServiceMemo (예전 정비 비고 나누기)", () => {
  it("빈 비고", () => {
    expect(parseServiceMemo("")).toEqual({ km: null, vendor: null, items: [], rest: null })
    expect(parseServiceMemo(null)).toEqual({ km: null, vendor: null, items: [], rest: null })
  })

  it("615,848km BOSCH배터리교체", () => {
    expect(parseServiceMemo("615,848km BOSCH배터리교체")).toEqual({
      km: 615848,
      vendor: null,
      items: [{ name: "BOSCH배터리교체", amount: null }],
      rest: null,
    })
  })

  it("615,848km 엔진오일 환영모터스 — 끝 단어 정비소", () => {
    expect(parseServiceMemo("615,848km 엔진오일 환영모터스")).toEqual({
      km: 615848,
      vendor: "환영모터스",
      items: [{ name: "엔진오일", amount: null }],
      rest: null,
    })
  })

  it("자동차점프스타터 / 엔진오일 — 항목 하나", () => {
    expect(parseServiceMemo("자동차점프스타터")).toEqual({
      km: null,
      vendor: null,
      items: [{ name: "자동차점프스타터", amount: null }],
      rest: null,
    })
    expect(names("엔진오일")).toEqual(["엔진오일"])
  })

  it("스로툴바디 교환(P2112) - 부산대저 블루핸즈", () => {
    expect(parseServiceMemo("스로툴바디 교환(P2112) - 부산대저 블루핸즈")).toEqual({
      km: null,
      vendor: "부산대저 블루핸즈",
      items: [{ name: "스로툴바디 교환(P2112)", amount: null }],
      rest: null,
    })
  })

  it("할부 표시는 버리고 증상은 나머지 비고로", () => {
    expect(
      parseServiceMemo(
        "스로툴바디 교환(P2112) - 부산대저 블루핸즈 (1/2) · 출력저하, 변속둔감,속도20~80km 중구난방"
      )
    ).toEqual({
      km: null,
      vendor: "부산대저 블루핸즈",
      items: [{ name: "스로툴바디 교환(P2112)", amount: null }],
      rest: "출력저하, 변속둔감,속도20~80km 중구난방",
    })
  })

  it("엔진오일,안개등2 — 쉼표로 나눔", () => {
    expect(names("엔진오일,안개등2")).toEqual(["엔진오일", "안개등2"])
  })

  it("563,477km 엔진오일,리어라이닝 (3/3) · 완정모터스", () => {
    expect(parseServiceMemo("563,477km 엔진오일,리어라이닝 (3/3) · 완정모터스")).toEqual({
      km: 563477,
      vendor: "완정모터스",
      items: [
        { name: "엔진오일", amount: null },
        { name: "리어라이닝", amount: null },
      ],
      rest: null,
    })
  })

  it("엔진&미션&데후오일은 한 항목, 할부 표시는 버림", () => {
    expect(parseServiceMemo("데후,프로펠러샤프트,리어라이닝,엔진&미션&데후오일 (6/6)")).toEqual({
      km: null,
      vendor: null,
      items: ["데후", "프로펠러샤프트", "리어라이닝", "엔진&미션&데후오일"].map((name) => ({
        name,
        amount: null,
      })),
      rest: null,
    })
  })

  it("587,578km 엔진오일 · 완정모터스", () => {
    expect(parseServiceMemo("587,578km 엔진오일 · 완정모터스")).toEqual({
      km: 587578,
      vendor: "완정모터스",
      items: [{ name: "엔진오일", amount: null }],
      rest: null,
    })
  })

  it("km가 항목 뒤에 있어도: 엔진오일 579,565km · 완정모터스", () => {
    expect(parseServiceMemo("엔진오일 579,565km · 완정모터스")).toEqual({
      km: 579565,
      vendor: "완정모터스",
      items: [{ name: "엔진오일", amount: null }],
      rest: null,
    })
  })

  it("요소수첨가제 불스원샷 500ml 3개 — 띄어쓰기 있어도 한 항목", () => {
    expect(parseServiceMemo("요소수첨가제 불스원샷 500ml 3개")).toEqual({
      km: null,
      vendor: null,
      items: [{ name: "요소수첨가제 불스원샷 500ml 3개", amount: null }],
      rest: null,
    })
  })

  it("너무 긴 내역은 앞 항목만 뽑고 나머지는 비고로", () => {
    expect(
      parseServiceMemo(
        "543,832km (3/3) · 엔진오일,에어컨콤프관련 수리엔진오일 80,000에어컨컴프1234+가스완충 650,000콘덴샤신품 220,000라이크리닝 80,000팽창벨브 45,000콘덴샤휀 150,000"
      )
    ).toEqual({
      km: 543832,
      vendor: null,
      items: [{ name: "엔진오일", amount: null }],
      rest: "에어컨콤프관련 수리엔진오일 80,000에어컨컴프1234+가스완충 650,000콘덴샤신품 220,000라이크리닝 80,000팽창벨브 45,000콘덴샤휀 150,000",
    })
  })

  it("쉼표 없는 4~7자리 km, 이름 뒤 금액", () => {
    expect(parseServiceMemo("엔진오일 80,000,와이퍼 15,000 612000km")).toEqual({
      km: 612000,
      vendor: null,
      items: [
        { name: "엔진오일", amount: 80000 },
        { name: "와이퍼", amount: 15000 },
      ],
      rest: null,
    })
  })

  it("항목과 붙어 쓴 정비소: 엔진오일환영모터스", () => {
    expect(parseServiceMemo("엔진오일환영모터스")).toEqual({
      km: null,
      vendor: "환영모터스",
      items: [{ name: "엔진오일", amount: null }],
      rest: null,
    })
  })

  it("'타이어' 한 단어는 정비소가 아니라 항목", () => {
    expect(parseServiceMemo("엔진오일 · 타이어")).toEqual({
      km: null,
      vendor: null,
      items: [{ name: "엔진오일", amount: null }],
      rest: "타이어",
    })
  })
})
