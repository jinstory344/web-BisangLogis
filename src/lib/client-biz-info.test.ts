import { describe, expect, it } from "vitest"

import { clientBizInfoText } from "./client-tax-info"

describe("clientBizInfoText", () => {
  it("계산서용 사업자 정보 모양", () => {
    expect(
      clientBizInfoText({
        name: "조은물류",
        biz_no: "6098618830",
        ceo_name: "조은주",
        address: "경상남도 창원시 진해구 신항4로 15-85, 201,202호",
        biz_type: "서비스",
        biz_item: "화물운송주선",
        contact_email: "joeun@jelogis.com",
        memo: "T. 055-716-2294\r\nF. 055-716-2297\r\n\r\n★계산서 발행시 비고란 기재",
      })
    ).toBe(
      "< 조은물류 사업자정보 >\n\n609-86-18830\n조은물류\n조은주\n경상남도 창원시 진해구 신항4로 15-85, 201,202호\n서비스, 화물운송주선\njoeun@jelogis.com\n\nT. 055-716-2294\nF. 055-716-2297\n\n★계산서 발행시 비고란 기재"
    )
  })

  it("빈 칸은 줄째로 뺀다", () => {
    expect(
      clientBizInfoText({
        name: "올기",
        biz_no: null,
        ceo_name: "",
        address: null,
        biz_type: "운수",
        biz_item: null,
        contact_email: null,
        memo: null,
      })
    ).toBe("< 올기 사업자정보 >\n\n올기\n운수")
  })
})
