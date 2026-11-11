import { describe, expect, it } from "vitest"

import { mergeClientDuplicates, type ClientMatch } from "./client-duplicates"

const a: ClientMatch = { id: "a", name: "아토무역", biz_no: "2208162517" }
const b: ClientMatch = { id: "b", name: "아토무역", biz_no: null }
const c: ClientMatch = { id: "c", name: "아토무역(주)", biz_no: "2208162517" }

describe("mergeClientDuplicates (등록 전 중복 확인 결과 합치기)", () => {
  it("둘 다 비면 중복이 없다", () => {
    expect(mergeClientDuplicates([], [])).toEqual([])
  })

  it("이름만 같은 거래처는 이름이 같다고만 표시한다", () => {
    expect(mergeClientDuplicates([b], [])).toEqual([
      { ...b, sameName: true, sameBizNo: false },
    ])
  })

  it("사업자번호만 같은 거래처는 사업자번호가 같다고만 표시한다", () => {
    expect(mergeClientDuplicates([], [c])).toEqual([
      { ...c, sameName: false, sameBizNo: true },
    ])
  })

  it("이름과 사업자번호가 모두 같은 거래처는 한 줄로 합쳐 이유 두 가지를 모두 표시한다", () => {
    expect(mergeClientDuplicates([a], [a])).toEqual([
      { ...a, sameName: true, sameBizNo: true },
    ])
  })

  it("여러 건이면 이름이 같은 것이 먼저, 사업자번호만 같은 것이 뒤에 온다", () => {
    const merged = mergeClientDuplicates([a, b], [c, a])

    expect(merged.map((row) => row.id)).toEqual(["a", "b", "c"])
    expect(merged.find((row) => row.id === "a")).toMatchObject({
      sameName: true,
      sameBizNo: true,
    })
    expect(merged.find((row) => row.id === "b")).toMatchObject({
      sameName: true,
      sameBizNo: false,
    })
    expect(merged.find((row) => row.id === "c")).toMatchObject({
      sameName: false,
      sameBizNo: true,
    })
  })

  it("입력 배열을 바꾸지 않는다", () => {
    const sameName = [a]
    const sameBizNo = [c]
    mergeClientDuplicates(sameName, sameBizNo)
    expect(sameName).toEqual([a])
    expect(sameBizNo).toEqual([c])
  })
})
