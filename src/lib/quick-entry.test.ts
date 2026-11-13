import { describe, expect, it } from "vitest"

import {
  getCopyHref,
  matchesQuery,
  parseCopyId,
  pickFrequentCandidates,
  isSameContact,
  pickRecentContacts,
  pickRecentDispatchContacts,
  pickRecentRoutes,
  searchCandidates,
  toDispatchCandidate,
  toDispatchCopyEntry,
  toExpenseCandidate,
  toExpenseCopyEntry,
  toSaleCandidate,
  toSaleCopyEntry,
  type CopyCandidate,
} from "./quick-entry"

describe("pickRecentRoutes (최근 구간 칩)", () => {
  it("최근 순서를 유지하며 서로 다른 상차지→하차지 조합만 최대 5개 고른다", () => {
    const rows = [
      { origin: "서울", destination: "부산" },
      { origin: "서울", destination: "부산" },
      { origin: "부산", destination: "서울" },
      { origin: "인천", destination: "대전" },
      { origin: "서울", destination: "부산" },
      { origin: "광주", destination: "대구" },
      { origin: "수원", destination: "울산" },
      { origin: "평택", destination: "포항" },
    ]

    expect(pickRecentRoutes(rows)).toEqual([
      { origin: "서울", destination: "부산" },
      { origin: "부산", destination: "서울" },
      { origin: "인천", destination: "대전" },
      { origin: "광주", destination: "대구" },
      { origin: "수원", destination: "울산" },
    ])
  })

  it("앞뒤 공백은 같은 조합으로 보고, 빈 값은 건너뛴다", () => {
    const rows = [
      { origin: " 서울 ", destination: "부산" },
      { origin: "서울", destination: "부산 " },
      { origin: "", destination: "부산" },
      { origin: "대전", destination: "  " },
    ]

    expect(pickRecentRoutes(rows)).toEqual([
      { origin: "서울", destination: "부산" },
    ])
  })

  it("구분자가 들어간 지명끼리도 섞이지 않는다", () => {
    const rows = [
      { origin: "A→B", destination: "C" },
      { origin: "A", destination: "B→C" },
    ]
    expect(pickRecentRoutes(rows)).toHaveLength(2)
  })

  it("limit을 지킨다", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      origin: `상차${i}`,
      destination: `하차${i}`,
    }))
    expect(pickRecentRoutes(rows, 3)).toHaveLength(3)
  })
})

const SALE_ROW = {
  id: "s1",
  created_at: "2026-11-08T03:00:00.000000+00:00",
  sale_date: "2026-11-08",
  origin: "서울",
  destination: "부산",
  supply_amount: 100000,
  source_major: "카카오톡",
  source_minor: "이양규",
  source_note: null,
  billing_entity_name: "하나운수",
  memo: "냉동",
}
const DISPATCH_ROW = {
  id: "d1",
  created_at: "2026-11-08T05:00:00.000000+00:00",
  dispatch_date: "2026-11-07",
  origin: "인천",
  destination: "대전",
  freight_amount: null,
  client_id: "c1",
  contact_name: "이준호",
  plate_no_snapshot: "서울86바7754",
  driver_name_snapshot: "김진승",
  memo: null,
}
const EXPENSE_ROW = {
  id: "e1",
  created_at: "2026-11-08T04:00:00.000000+00:00",
  expense_date: "2026-11-06",
  category_major: "차량",
  category_minor: "유류",
  amount: 50000,
  payment_method: "CARD" as const,
  vendor: null,
  memo: null,
}

describe("pickRecentContacts (최근 연락처 칩)", () => {
  const rows = (phones: (string | null)[]) =>
    phones.map((order_contact_phone) => ({ order_contact_phone }))

  it("최근 순서를 유지하며 서로 다른 연락처만 최대 5개 고른다", () => {
    const result = pickRecentContacts(
      rows([
        "010-1111-1111",
        "010-2222-2222",
        "010-1111-1111",
        "010-3333-3333",
        "010-4444-4444",
        "010-5555-5555",
        "010-6666-6666",
      ])
    )

    expect(result).toEqual([
      "010-1111-1111",
      "010-2222-2222",
      "010-3333-3333",
      "010-4444-4444",
      "010-5555-5555",
    ])
  })

  it("표기만 다른 같은 번호는 하나로 보고 가장 최근 표기를 남긴다", () => {
    expect(
      pickRecentContacts(
        rows(["010-1234-5678", "01012345678", "010 1234 5678", "02-123-4567"])
      )
    ).toEqual(["010-1234-5678", "02-123-4567"])
  })

  it("비었거나 숫자가 없는 값은 건너뛰고, 앞뒤 공백은 지운다", () => {
    expect(
      pickRecentContacts(rows([null, "", "   ", "-", "  010-9999-0000  "]))
    ).toEqual(["010-9999-0000"])
  })

  it("limit을 줄 수 있고, 행이 없으면 빈 배열이다", () => {
    expect(
      pickRecentContacts(rows(["010-1111-1111", "010-2222-2222"]), 1)
    ).toEqual(["010-1111-1111"])
    expect(pickRecentContacts([])).toEqual([])
  })
})

describe("pickRecentDispatchContacts (배차 최근 담당자 칩)", () => {
  const rows = (pairs: [string | null, string | null][]) =>
    pairs.map(([contact_name, contact_phone]) => ({
      contact_name,
      contact_phone,
    }))

  it("최근 순서를 유지하며 서로 다른 담당자(이름+연락처)만 최대 5개 고른다", () => {
    const result = pickRecentDispatchContacts(
      rows([
        ["박대유", "010-1111-1111"],
        ["이재근", "010-2222-2222"],
        ["박대유", "010-1111-1111"],
        ["이준호", "010-3333-3333"],
        ["최하나", "010-4444-4444"],
        ["김둘", "010-5555-5555"],
        ["정셋", "010-6666-6666"],
      ])
    )

    expect(result.map((c) => c.name)).toEqual([
      "박대유",
      "이재근",
      "이준호",
      "최하나",
      "김둘",
    ])
  })

  it("이름이 같아도 번호가 다르면 다른 담당자다 (번호 표기만 다르면 같은 담당자)", () => {
    expect(
      pickRecentDispatchContacts(
        rows([
          ["박대유", "010-1111-1111"],
          ["박대유", "01011111111"],
          ["박대유", "010-9999-9999"],
        ])
      )
    ).toEqual([
      { name: "박대유", phone: "010-1111-1111" },
      { name: "박대유", phone: "010-9999-9999" },
    ])
  })

  it("연락처를 적기 전의 이름만 있는 예전 건은 같은 이름의 연락처 있는 칩이 있으면 건너뛴다", () => {
    // 최근 건이 이름만이어도, 같은 이름에 연락처가 있는 건이 있으면 그 칩 하나만 남는다.
    expect(
      pickRecentDispatchContacts(
        rows([
          ["박대유", null],
          ["이재근", null],
          ["박대유", "010-1111-1111"],
        ])
      )
    ).toEqual([
      { name: "이재근", phone: "" },
      { name: "박대유", phone: "010-1111-1111" },
    ])
  })

  it("이름 없이 번호만 적은 건은 같은 번호의 이름 있는 칩이 있을 때만 건너뛴다", () => {
    expect(
      pickRecentDispatchContacts(
        rows([
          [null, "01011111111"],
          ["박대유", "010-1111-1111"],
          [null, "010-7777-7777"],
        ])
      )
    ).toEqual([
      { name: "박대유", phone: "010-1111-1111" },
      { name: "", phone: "010-7777-7777" },
    ])
  })

  it("이름도 번호도 없는 행과 숫자 없는 번호는 건너뛰고, 공백은 지운다", () => {
    expect(
      pickRecentDispatchContacts(
        rows([
          [null, null],
          ["", "  "],
          [" ", "-"],
          ["  박대유 ", "-"],
        ])
      )
    ).toEqual([{ name: "박대유", phone: "" }])
  })

  it("limit을 줄 수 있고, 행이 없으면 빈 배열이다", () => {
    expect(
      pickRecentDispatchContacts(
        rows([
          ["가", "010-1111-1111"],
          ["나", "010-2222-2222"],
        ]),
        1
      )
    ).toEqual([{ name: "가", phone: "010-1111-1111" }])
    expect(pickRecentDispatchContacts([])).toEqual([])
  })
})

describe("isSameContact (칩 선택 상태)", () => {
  it("이름과 번호(숫자만 비교)가 모두 같을 때만 같은 담당자다", () => {
    const chip = { name: "박대유", phone: "010-1111-1111" }
    expect(isSameContact(chip, { name: " 박대유 ", phone: "01011111111" })).toBe(
      true
    )
    expect(isSameContact(chip, { name: "박대유", phone: "010-2222-2222" })).toBe(
      false
    )
    expect(isSameContact(chip, { name: "이재근", phone: "010-1111-1111" })).toBe(
      false
    )
    expect(isSameContact(chip, { name: "박대유", phone: "" })).toBe(false)
  })

  it("매출처럼 이름이 비어 있으면 번호만 비교하고, 둘 다 비면 같지 않다", () => {
    expect(
      isSameContact(
        { name: "", phone: "010-1111-1111" },
        { name: "", phone: "01011111111" }
      )
    ).toBe(true)
    expect(
      isSameContact({ name: "", phone: "" }, { name: "", phone: "" })
    ).toBe(false)
  })
})

describe("최근 건 복사 목록", () => {
  const sale = toSaleCopyEntry({
    id: "s1",
    created_at: "2026-11-08T03:00:00.000000+00:00",
    sale_date: "2026-11-08",
    origin: "서울",
    destination: "부산",
    supply_amount: 100000,
  })
  const dispatch = toDispatchCopyEntry({
    id: "d1",
    created_at: "2026-11-08T05:00:00.000000+00:00",
    dispatch_date: "2026-11-07",
    origin: "인천",
    destination: "대전",
    freight_amount: null,
  })
  const expense = toExpenseCopyEntry({
    id: "e1",
    created_at: "2026-11-08T04:00:00.000000+00:00",
    expense_date: "2026-11-06",
    category_major: "차량",
    category_minor: "유류",
    amount: 50000,
  })

  it("종류별 요약·금액을 만든다 (매출은 목록과 같은 공급가액, 배차 운임 미입력은 null)", () => {
    expect(sale).toEqual({
      kind: "sales",
      id: "s1",
      createdAt: "2026-11-08T03:00:00.000000+00:00",
      date: "2026-11-08",
      summary: "서울 → 부산",
      amount: 100000,
    })
    expect(dispatch.summary).toBe("인천 → 대전")
    expect(dispatch.amount).toBeNull()
    expect(expense.summary).toBe("차량·유류")
    expect(expense.amount).toBe(50000)
  })

  it("행에 전화번호 등 다른 컬럼이 있어도 결과에는 담지 않는다", () => {
    const entry = toDispatchCopyEntry({
      id: "d2",
      created_at: "2026-11-08T05:00:00+00:00",
      dispatch_date: "2026-11-08",
      origin: "서울",
      destination: "부산",
      freight_amount: 90000,
      // 실수로 select("*")를 넘겨도 개인정보가 새지 않아야 한다.
      ...({ driver_phone_snapshot: "010-0000-0000" } as object),
    } as Parameters<typeof toDispatchCopyEntry>[0])

    expect(Object.keys(entry).sort()).toEqual(
      ["amount", "createdAt", "date", "id", "kind", "summary"].sort()
    )
    expect(JSON.stringify(entry)).not.toContain("010-0000-0000")
  })

  it("세 종류를 created_at 최신순으로 합쳐 limit개만 남긴다 (검색어가 비면 최근 건)", () => {
    const older: CopyCandidate[] = Array.from({ length: 5 }, (_, i) =>
      toSaleCandidate({
        ...SALE_ROW,
        id: `old${i}`,
        created_at: `2026-11-0${i + 1}T00:00:00+00:00`,
      })
    )

    const { entries, total } = searchCandidates(
      [
        toSaleCandidate(SALE_ROW),
        ...older,
        toDispatchCandidate(DISPATCH_ROW, null),
        toExpenseCandidate(EXPENSE_ROW),
      ],
      { limit: 5 }
    )

    expect(entries.map((entry) => entry.id)).toEqual([
      "d1",
      "e1",
      "s1",
      "old4",
      "old3",
    ])
    expect(total).toBe(8)
  })

  it("항목이 없으면 빈 결과", () => {
    expect(searchCandidates([], { limit: 5 })).toEqual({ entries: [], total: 0 })
  })

  it("복사 링크는 통합 등록 화면 /new?type={종류}&copy={id}", () => {
    expect(getCopyHref("sales", "abc")).toBe("/new?type=sale&copy=abc")
    expect(getCopyHref("dispatches", "abc")).toBe("/new?type=dispatch&copy=abc")
    expect(getCopyHref("expenses", "abc")).toBe("/new?type=expense&copy=abc")
  })
})

describe("parseCopyId (?copy= 검증)", () => {
  const id = "0f00a22b-2dc5-4d94-b891-34858f678835"

  it("UUID면 그대로 돌려준다", () => {
    expect(parseCopyId(id)).toBe(id)
    expect(parseCopyId(id.toUpperCase())).toBe(id)
  })

  it("여러 번 오면 첫 값만 본다", () => {
    expect(parseCopyId([id, "other"])).toBe(id)
  })

  it("없거나 형식이 잘못되면 null (빈 폼)", () => {
    expect(parseCopyId(undefined)).toBeNull()
    expect(parseCopyId("")).toBeNull()
    expect(parseCopyId("123")).toBeNull()
    expect(parseCopyId(`${id}' or 1=1`)).toBeNull()
    expect(parseCopyId([])).toBeNull()
  })
})

describe("후보(CopyCandidate) 만들기", () => {
  it("검색 문자열에는 종류·구간·거래처·출처·차량·기사·메모·금액이 들어가고 전화번호는 없다", () => {
    const sale = toSaleCandidate({
      ...SALE_ROW,
      // 실수로 select("*")를 넘겨도 오더자 전화번호가 검색 대상·결과에 새지 않아야 한다.
      ...({ order_contact_phone: "010-5208-5896" } as object),
    } as Parameters<typeof toSaleCandidate>[0])
    const dispatch = toDispatchCandidate(
      {
        ...DISPATCH_ROW,
        ...({ driver_phone_snapshot: "010-2746-0344" } as object),
      } as Parameters<typeof toDispatchCandidate>[0],
      "아토무역"
    )

    expect(sale.search).toContain("매출")
    expect(sale.search).toContain("카카오톡")
    expect(sale.search).toContain("이양규")
    expect(sale.search).toContain("하나운수")
    expect(sale.search).toContain("100000")
    expect(sale.search).toContain("100,000")
    expect(dispatch.search).toContain("배차")
    expect(dispatch.search).toContain("아토무역")
    expect(dispatch.search).toContain("서울86바7754")
    expect(dispatch.search).toContain("김진승")
    expect(JSON.stringify([sale, dispatch])).not.toMatch(/010-?\d{4}-?\d{4}/)
  })

  it("배차 거래처가 없거나 모르면 이름 없이 만든다", () => {
    const dispatch = toDispatchCandidate(
      { ...DISPATCH_ROW, client_id: null },
      null
    )
    expect(dispatch.search).not.toContain("null")
    expect(dispatch.group).toBe(JSON.stringify(["dispatches", "", "인천", "대전"]))
  })
})

describe("matchesQuery (검색어 일치)", () => {
  const search = toSaleCandidate(SALE_ROW).search

  it("빈 검색어는 전부 일치한다", () => {
    expect(matchesQuery(search, "")).toBe(true)
    expect(matchesQuery(search, "   ")).toBe(true)
  })

  it("공백으로 나눈 낱말이 모두 들어 있어야 일치한다 (순서 무관)", () => {
    expect(matchesQuery(search, "서울")).toBe(true)
    expect(matchesQuery(search, "서울 부산")).toBe(true)
    expect(matchesQuery(search, "부산 서울")).toBe(true)
    expect(matchesQuery(search, "서울 대구")).toBe(false)
  })

  it("대소문자와 앞뒤 공백을 무시하고 일부만 써도 일치한다", () => {
    const withLatin = toExpenseCandidate({
      ...EXPENSE_ROW,
      memo: "GS칼텍스 주유",
    }).search
    expect(matchesQuery(withLatin, "  gs칼텍스 ")).toBe(true)
    expect(matchesQuery(withLatin, "칼텍")).toBe(true)
  })

  it("금액은 쉼표 유무와 상관없이 찾을 수 있다", () => {
    expect(matchesQuery(search, "100000")).toBe(true)
    expect(matchesQuery(search, "100,000")).toBe(true)
    expect(matchesQuery(search, "999")).toBe(false)
  })

  it("종류 이름으로도 좁힐 수 있다", () => {
    expect(matchesQuery(search, "매출 서울")).toBe(true)
    expect(matchesQuery(search, "지출 서울")).toBe(false)
  })
})

describe("searchCandidates (종류 필터·검색·더 보기)", () => {
  const candidates = [
    toSaleCandidate(SALE_ROW),
    toSaleCandidate({
      ...SALE_ROW,
      id: "s2",
      created_at: "2026-11-09T03:00:00+00:00",
      origin: "광주",
      destination: "목포",
    }),
    toDispatchCandidate(DISPATCH_ROW, "아토무역"),
    toExpenseCandidate(EXPENSE_ROW),
  ]

  it("검색어에 맞는 건만 최신순으로 돌려주고 total은 limit 적용 전 개수다", () => {
    // "서울"은 매출 s1의 출발지와 배차 d1의 차량번호(서울86바7754) 둘 다에 일치한다
    const result = searchCandidates(candidates, { query: "서울", limit: 1 })
    expect(result.entries.map((entry) => entry.id)).toEqual(["d1"])
    expect(result.total).toBe(2)

    const all = searchCandidates(candidates, { limit: 2 })
    expect(all.entries.map((entry) => entry.id)).toEqual(["s2", "d1"])
    expect(all.total).toBe(4)
  })

  it("종류 필터를 걸면 그 종류만 남는다", () => {
    const sales = searchCandidates(candidates, { kind: "sales", limit: 10 })
    expect(sales.entries.map((entry) => entry.id)).toEqual(["s2", "s1"])

    const expenses = searchCandidates(candidates, { kind: "expenses", limit: 10 })
    expect(expenses.entries.map((entry) => entry.id)).toEqual(["e1"])
  })

  it("거래처 이름·차량번호·기사명으로 배차를 찾는다", () => {
    expect(
      searchCandidates(candidates, { query: "아토무역", limit: 10 }).entries.map(
        (entry) => entry.id
      )
    ).toEqual(["d1"])
    expect(
      searchCandidates(candidates, { query: "86바7754", limit: 10 }).total
    ).toBe(1)
    expect(searchCandidates(candidates, { query: "김진승", limit: 10 }).total).toBe(1)
  })

  it("일치하는 건이 없으면 빈 결과", () => {
    expect(
      searchCandidates(candidates, { query: "없는검색어", limit: 10 })
    ).toEqual({ entries: [], total: 0 })
  })

  it("limit이 0이면 항목은 비지만 total은 유지한다", () => {
    expect(searchCandidates(candidates, { limit: 0 })).toEqual({
      entries: [],
      total: 4,
    })
  })
})

describe("pickFrequentCandidates (자주 쓰는 건)", () => {
  const sale = (id: string, createdAt: string, route: [string, string], minor = "이양규") =>
    toSaleCandidate({
      ...SALE_ROW,
      id,
      created_at: createdAt,
      origin: route[0],
      destination: route[1],
      source_minor: minor,
    })
  const expense = (id: string, createdAt: string, minor: string, amount: number) =>
    toExpenseCandidate({
      ...EXPENSE_ROW,
      id,
      created_at: createdAt,
      category_minor: minor,
      amount,
    })

  it("같은 유형을 2번 이상 등록한 것만 횟수 많은 순으로, 대표는 가장 최근 건이다", () => {
    const candidates = [
      sale("a1", "2026-11-01T00:00:00+00:00", ["서울", "부산"]),
      sale("a2", "2026-11-05T00:00:00+00:00", ["서울", "부산"]),
      sale("a3", "2026-11-03T00:00:00+00:00", ["서울", "부산"]),
      sale("b1", "2026-11-02T00:00:00+00:00", ["광주", "목포"]),
      sale("b2", "2026-11-09T00:00:00+00:00", ["광주", "목포"]),
      sale("c1", "2026-11-08T00:00:00+00:00", ["대구", "구미"]), // 1번뿐이라 제외
    ]

    const frequent = pickFrequentCandidates(candidates)
    expect(frequent.map((entry) => [entry.id, entry.count])).toEqual([
      ["a2", 3],
      ["b2", 2],
    ])
  })

  it("횟수가 같으면 더 최근에 쓴 유형이 먼저 나온다", () => {
    const candidates = [
      sale("a1", "2026-11-01T00:00:00+00:00", ["서울", "부산"]),
      sale("a2", "2026-11-02T00:00:00+00:00", ["서울", "부산"]),
      sale("b1", "2026-11-03T00:00:00+00:00", ["광주", "목포"]),
      sale("b2", "2026-11-04T00:00:00+00:00", ["광주", "목포"]),
    ]
    expect(pickFrequentCandidates(candidates).map((entry) => entry.id)).toEqual([
      "b2",
      "a2",
    ])
  })

  it("출처 소분류가 다르면 같은 구간이어도 다른 유형으로 센다", () => {
    const candidates = [
      sale("a1", "2026-11-01T00:00:00+00:00", ["서울", "부산"], "이양규"),
      sale("a2", "2026-11-02T00:00:00+00:00", ["서울", "부산"], "김철수"),
    ]
    expect(pickFrequentCandidates(candidates)).toEqual([])
  })

  it("지출은 분류가 같으면 금액이 달라도 같은 유형이고, 대표 건의 금액을 보여준다", () => {
    const candidates = [
      expense("e1", "2026-11-01T00:00:00+00:00", "유류", 40000),
      expense("e2", "2026-11-04T00:00:00+00:00", "유류", 52000),
      expense("e3", "2026-11-03T00:00:00+00:00", "정비", 30000),
    ]
    const frequent = pickFrequentCandidates(candidates)
    expect(frequent).toHaveLength(1)
    expect(frequent[0]).toMatchObject({ id: "e2", count: 2, amount: 52000 })
  })

  it("종류 필터, limit, minCount를 지킨다", () => {
    const candidates = [
      sale("a1", "2026-11-01T00:00:00+00:00", ["서울", "부산"]),
      sale("a2", "2026-11-02T00:00:00+00:00", ["서울", "부산"]),
      expense("e1", "2026-11-01T00:00:00+00:00", "유류", 40000),
      expense("e2", "2026-11-02T00:00:00+00:00", "유류", 40000),
    ]
    expect(
      pickFrequentCandidates(candidates, { kind: "expenses" }).map((e) => e.id)
    ).toEqual(["e2"])
    expect(pickFrequentCandidates(candidates, { limit: 1 })).toHaveLength(1)
    expect(pickFrequentCandidates(candidates, { minCount: 3 })).toEqual([])
  })
})

describe("pickFrequentRoutes", () => {
  it("자주 다닌 구간부터, 같은 횟수면 최근 구간부터", async () => {
    const { pickFrequentRoutes } = await import("./quick-entry")
    const r = (origin: string, destination: string) => ({ origin, destination })
    // 최근 순으로 들어온 행
    const rows = [r("A", "B"), r("C", "D"), r("E", "F"), r("C", "D"), r("A", "B"), r("C", "D"), r("G", "H"), r(" ", "X")]
    expect(pickFrequentRoutes(rows, 3)).toEqual([r("C", "D"), r("A", "B"), r("E", "F")])
  })
})
