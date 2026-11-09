import { describe, expect, it } from "vitest"

import {
  getCopyHref,
  mergeRecentCopyEntries,
  parseCopyId,
  pickRecentRoutes,
  toDispatchCopyEntry,
  toExpenseCopyEntry,
  toSaleCopyEntry,
  type RecentCopyEntry,
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

  it("세 종류를 created_at 최신순으로 합쳐 최대 5건만 남긴다", () => {
    const older: RecentCopyEntry[] = Array.from({ length: 5 }, (_, i) =>
      toSaleCopyEntry({
        id: `old${i}`,
        created_at: `2026-11-0${i + 1}T00:00:00+00:00`,
        sale_date: "2026-11-01",
        origin: "a",
        destination: "b",
        supply_amount: 1,
      })
    )

    const merged = mergeRecentCopyEntries([[sale, ...older], [dispatch], [expense]])

    expect(merged.map((entry) => entry.id)).toEqual([
      "d1",
      "e1",
      "s1",
      "old4",
      "old3",
    ])
  })

  it("항목이 없으면 빈 배열", () => {
    expect(mergeRecentCopyEntries([[], [], []])).toEqual([])
  })

  it("복사 링크는 /{종류}/new?copy={id}", () => {
    expect(getCopyHref("sales", "abc")).toBe("/sales/new?copy=abc")
    expect(getCopyHref("dispatches", "abc")).toBe("/dispatches/new?copy=abc")
    expect(getCopyHref("expenses", "abc")).toBe("/expenses/new?copy=abc")
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
