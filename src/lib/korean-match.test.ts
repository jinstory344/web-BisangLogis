import { describe, expect, it } from "vitest"

import { filterSuggestions, startsWithKorean } from "./korean-match"

describe("startsWithKorean", () => {
  it("빈 입력은 맞지 않는다", () => {
    expect(startsWithKorean("부산", "")).toBe(false)
    expect(startsWithKorean("부산", "  ")).toBe(false)
  })

  it("첫소리(자음)만 치면 첫소리가 같은 것", () => {
    expect(startsWithKorean("부산서구", "ㅂ")).toBe(true)
    expect(startsWithKorean("반월", "ㅂ")).toBe(true)
    expect(startsWithKorean("평택", "ㅂ")).toBe(false)
  })

  it("글자를 치면 그 글자로 시작하는 것 (받침 유무 상관없이)", () => {
    expect(startsWithKorean("부산", "부")).toBe(true)
    expect(startsWithKorean("북항", "부")).toBe(true)
    expect(startsWithKorean("반월", "부")).toBe(false)
    expect(startsWithKorean("사부", "부")).toBe(false)
  })

  it("받침이 다음 글자 첫소리가 되는 입력 도중", () => {
    expect(startsWithKorean("부산", "붓")).toBe(true)
    expect(startsWithKorean("부천", "붓")).toBe(false)
    expect(startsWithKorean("붓글씨", "붓")).toBe(true)
  })

  it("받침을 겹받침으로 치는 중 / 겹받침이 나뉘는 중", () => {
    expect(startsWithKorean("닭갈비", "달")).toBe(true)
    expect(startsWithKorean("달걀", "닭")).toBe(true)
    expect(startsWithKorean("달리", "닭")).toBe(false)
  })

  it("겹모음을 치는 중", () => {
    expect(startsWithKorean("화성", "호")).toBe(true)
    expect(startsWithKorean("화성", "하")).toBe(false)
  })

  it("여러 글자: 앞 글자는 정확히, 마지막 글자는 치는 중이어도", () => {
    expect(startsWithKorean("부산서구 해원", "부산ㅅ")).toBe(true)
    expect(startsWithKorean("부산서구 해원", "부산서")).toBe(true)
    expect(startsWithKorean("부산 장림", "부산서")).toBe(false)
    expect(startsWithKorean("부천", "부산")).toBe(false)
  })

  it("첫소리만 여러 개", () => {
    expect(startsWithKorean("부산", "ㅂㅅ")).toBe(true)
    expect(startsWithKorean("부천", "ㅂㅅ")).toBe(false)
  })

  it("후보보다 입력이 길면 맞지 않는다", () => {
    expect(startsWithKorean("부", "부산")).toBe(false)
  })

  it("영문은 대소문자 무시, 앞뒤 공백 무시", () => {
    expect(startsWithKorean("CJ대한통운", "cj")).toBe(true)
    expect(startsWithKorean(" 부산", "부")).toBe(true)
  })
})

describe("filterSuggestions", () => {
  const pool = ["부산서구 해원", "평택서탄", "부천", "북항", "반월", "부산 장림"]

  it("입력이 없으면 아무것도 보여 주지 않는다", () => {
    expect(filterSuggestions(pool, "")).toEqual([])
  })

  it("시작하는 것만 원래 순서대로", () => {
    expect(filterSuggestions(pool, "ㅂ")).toEqual([
      "부산서구 해원",
      "부천",
      "북항",
      "반월",
      "부산 장림",
    ])
    expect(filterSuggestions(pool, "부산")).toEqual(["부산서구 해원", "부산 장림"])
  })

  it("입력과 똑같은 값은 빼고 개수 제한", () => {
    expect(filterSuggestions(pool, "부천")).toEqual([])
    expect(filterSuggestions(pool, "ㅂ", 2)).toEqual(["부산서구 해원", "부천"])
  })
})
