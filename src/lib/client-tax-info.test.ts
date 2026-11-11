import { describe, expect, it } from "vitest"

import {
  formatTaxInfoStatus,
  getTaxInfoStatus,
  TAX_INFO_REQUIRED_FIELDS,
} from "./client-tax-info"

const complete = {
  biz_no: "1234567890",
  ceo_name: "홍길동",
  address: "서울시 중구",
  biz_type: "운수업",
  biz_item: "화물운송",
}

describe("getTaxInfoStatus (거래처 세금계산서 정보 입력 상태)", () => {
  it("필수 5개 항목이 모두 있으면 완비다", () => {
    expect(getTaxInfoStatus(complete)).toEqual({
      filled: 5,
      total: 5,
      level: "complete",
    })
  })

  it("하나도 없으면 없음이다 (null·undefined·빈 문자열·공백 모두)", () => {
    expect(getTaxInfoStatus({})).toEqual({ filled: 0, total: 5, level: "empty" })
    expect(
      getTaxInfoStatus({
        biz_no: null,
        ceo_name: undefined,
        address: "",
        biz_type: "   ",
        biz_item: "\n",
      }).level
    ).toBe("empty")
  })

  it("일부만 있으면 몇 개가 채워졌는지 센다", () => {
    expect(
      getTaxInfoStatus({ biz_no: "1234567890", ceo_name: "홍길동" })
    ).toEqual({ filled: 2, total: 5, level: "partial" })
    expect(getTaxInfoStatus({ ...complete, biz_item: "" })).toEqual({
      filled: 4,
      total: 5,
      level: "partial",
    })
  })

  it("수신 이메일·담당자 등 필수가 아닌 항목은 완비 여부에 영향이 없다", () => {
    const withExtras = {
      ...complete,
      contact_email: "",
      contact_name: "",
      memo: "",
    }
    expect(getTaxInfoStatus(withExtras).level).toBe("complete")
    const onlyExtras = {
      biz_no: "",
      contact_email: "a@b.com",
      contact_name: "김",
    }
    expect(getTaxInfoStatus(onlyExtras).level).toBe("empty")
  })

  it("거래처 행(null 섞인 DB 값)을 그대로 넘길 수 있다", () => {
    const row = {
      id: "x",
      name: "우영로지스",
      biz_no: "1234567890",
      ceo_name: null,
      address: null,
      biz_type: null,
      biz_item: null,
    }
    expect(getTaxInfoStatus(row)).toEqual({
      filled: 1,
      total: 5,
      level: "partial",
    })
  })

  it("필수 항목 목록이 사업자번호·대표자·주소·업태·종목이다", () => {
    expect([...TAX_INFO_REQUIRED_FIELDS]).toEqual([
      "biz_no",
      "ceo_name",
      "address",
      "biz_type",
      "biz_item",
    ])
  })
})

describe("formatTaxInfoStatus (화면 문구)", () => {
  it("상태별 문구를 만든다", () => {
    expect(formatTaxInfoStatus(getTaxInfoStatus(complete))).toBe(
      "계산서 정보 완비"
    )
    expect(formatTaxInfoStatus(getTaxInfoStatus({}))).toBe("계산서 정보 없음")
    expect(
      formatTaxInfoStatus(getTaxInfoStatus({ biz_no: "1", ceo_name: "홍" }))
    ).toBe("계산서 정보 2/5")
  })
})
