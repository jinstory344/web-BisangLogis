import { describe, expect, it } from "vitest"

import { getTaxInfoStatus } from "./client-tax-info"
import {
  SALE_CLIENT_CHIP_LIMIT,
  countSalesByClient,
  nextBillingEntityName,
  pickDisplayedSaleClients,
  rankSaleClientChoices,
  type SaleClientChoice,
} from "./sale-clients"

function choice(id: string, name: string): SaleClientChoice {
  return { id, name, category: "OTHER", taxStatus: getTaxInfoStatus({}) }
}

describe("countSalesByClient", () => {
  it("거래처별 매출 건수를 세고 연결 없는 건(null)은 건너뛴다", () => {
    const counts = countSalesByClient([
      { client_id: "a" },
      { client_id: "b" },
      { client_id: "a" },
      { client_id: null },
    ])
    expect(Object.fromEntries(counts)).toEqual({ a: 2, b: 1 })
    expect(countSalesByClient([]).size).toBe(0)
  })
})

describe("rankSaleClientChoices (매출에서 많이 쓴 순)", () => {
  const list = [
    choice("a", "하나운수"),
    choice("b", "우영로지스"),
    choice("c", "가나다상사"),
    choice("d", "올기"),
  ]

  it("매출 건수가 많은 거래처가 앞이고, 건수가 같으면 가나다순이다", () => {
    const ranked = rankSaleClientChoices(
      list,
      new Map([
        ["b", 3],
        ["d", 1],
      ])
    )
    expect(ranked.map((c) => c.name)).toEqual([
      "우영로지스", // 3건
      "올기", // 1건
      "가나다상사", // 0건끼리 가나다순
      "하나운수",
    ])
  })

  it("사용 기록이 없으면 이름순이고 원본 배열은 바뀌지 않는다", () => {
    const original = [...list]
    const ranked = rankSaleClientChoices(list, new Map())
    expect(ranked.map((c) => c.name)).toEqual([
      "가나다상사",
      "올기",
      "우영로지스",
      "하나운수",
    ])
    expect(list).toEqual(original)
  })
})

describe("pickDisplayedSaleClients (칩으로 보여 줄 거래처)", () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    choice(`id${i}`, `거래처${String(i).padStart(2, "0")}`)
  )

  it("앞쪽 최대 개수만 보여 준다", () => {
    expect(SALE_CLIENT_CHIP_LIMIT).toBe(8)
    expect(pickDisplayedSaleClients(many, "")).toHaveLength(8)
    expect(pickDisplayedSaleClients(many.slice(0, 3), "")).toHaveLength(3)
  })

  it("선택된 거래처가 앞쪽 밖에 있으면 맨 뒤에 덧붙여 보이게 한다", () => {
    const shown = pickDisplayedSaleClients(many, "id10")
    expect(shown).toHaveLength(9)
    expect(shown[8].id).toBe("id10")
  })

  it("선택된 거래처가 이미 보이거나, 목록에 없거나, 없으면 그대로다", () => {
    expect(pickDisplayedSaleClients(many, "id2")).toHaveLength(8)
    expect(pickDisplayedSaleClients(many, "없는id")).toHaveLength(8)
    expect(pickDisplayedSaleClients([], "x")).toEqual([])
  })
})

describe("nextBillingEntityName (거래처 선택 시 계산서정보 자동 입력)", () => {
  it("계산서정보가 비어 있으면 선택한 거래처 이름으로 채운다", () => {
    expect(
      nextBillingEntityName({
        currentBilling: "",
        previousClientName: "",
        nextClientName: "우영로지스",
      })
    ).toBe("우영로지스")
    expect(
      nextBillingEntityName({
        currentBilling: "   ",
        previousClientName: "",
        nextClientName: "우영로지스",
      })
    ).toBe("우영로지스")
  })

  it("이전에 고른 거래처 이름 그대로면(자동 입력으로 보고) 새 이름으로 바꾼다", () => {
    expect(
      nextBillingEntityName({
        currentBilling: "우영로지스",
        previousClientName: "우영로지스",
        nextClientName: "올기",
      })
    ).toBe("올기")
  })

  it("직접 다르게 적은 계산서정보는 건드리지 않는다 (null)", () => {
    expect(
      nextBillingEntityName({
        currentBilling: "주식회사 더엠컴퍼니",
        previousClientName: "우영로지스",
        nextClientName: "올기",
      })
    ).toBeNull()
    expect(
      nextBillingEntityName({
        currentBilling: "주식회사 더엠컴퍼니",
        previousClientName: "",
        nextClientName: "올기",
      })
    ).toBeNull()
  })

  it("거래처를 해제하면 자동으로 채웠던 값만 비우고, 직접 적은 값은 남긴다", () => {
    expect(
      nextBillingEntityName({
        currentBilling: "우영로지스",
        previousClientName: "우영로지스",
        nextClientName: null,
      })
    ).toBe("")
    expect(
      nextBillingEntityName({
        currentBilling: "주식회사 더엠컴퍼니",
        previousClientName: "우영로지스",
        nextClientName: null,
      })
    ).toBeNull()
  })

  it("앞뒤 공백은 같은 이름으로 본다", () => {
    expect(
      nextBillingEntityName({
        currentBilling: " 우영로지스 ",
        previousClientName: "우영로지스",
        nextClientName: " 올기 ",
      })
    ).toBe("올기")
  })
})
