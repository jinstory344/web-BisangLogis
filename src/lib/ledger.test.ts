import { describe, expect, it } from "vitest"

import {
  buildDayBuckets,
  buildMonthBuckets,
  buildWeekBuckets,
  buildYearBuckets,
  filterLedgerEntries,
  formatMonthBucketLabel,
  formatWeekBucketLabel,
  getLedgerRange,
  parseAnchorDate,
  parseLedgerKind,
  parseLedgerView,
  sumTotals,
  type AmountRow,
  type LedgerEntry,
} from "./ledger"

const sale = (date: string, income: number): AmountRow => ({
  date,
  income,
  expense: 0,
})
const spend = (date: string, expense: number): AmountRow => ({
  date,
  income: 0,
  expense,
})

describe("parseLedgerView", () => {
  it("알 수 없는 값이면 일일, 첫 값만 본다", () => {
    expect(parseLedgerView(undefined)).toBe("day")
    expect(parseLedgerView("bogus")).toBe("day")
    expect(parseLedgerView("week")).toBe("week")
    expect(parseLedgerView(["year", "week"])).toBe("year")
  })
})

describe("sumTotals", () => {
  it("매출·지출 합계와 차액(매출 − 지출)을 구한다", () => {
    expect(sumTotals([sale("2026-11-01", 300000), spend("2026-11-02", 90000)])).toEqual({
      income: 300000,
      expense: 90000,
      net: 210000,
    })
  })

  it("지출이 더 크면 차액이 음수이고, 비어 있으면 전부 0이다", () => {
    expect(sumTotals([spend("2026-11-02", 500)]).net).toBe(-500)
    expect(sumTotals([])).toEqual({ income: 0, expense: 0, net: 0 })
  })
})

describe("buildDayBuckets (일일 장부)", () => {
  const entry = (
    id: string,
    kind: "sale" | "expense",
    date: string,
    amount: number,
    createdAt: string
  ): LedgerEntry => ({ id, kind, date, amount, createdAt })

  const entries = [
    entry("a", "sale", "2026-11-12", 300000, "2026-11-12T01:00:00Z"),
    entry("b", "expense", "2026-11-12", 90000, "2026-11-12T03:00:00Z"),
    entry("c", "sale", "2026-11-09", 200000, "2026-11-09T01:00:00Z"),
    entry("d", "sale", "2026-11-12", 200000, "2026-11-12T02:00:00Z"),
  ]

  it("날짜별로 묶고 최근 날짜가 먼저이며, 날짜마다 매출·지출·차액을 구한다", () => {
    const buckets = buildDayBuckets(entries)
    expect(buckets.map((b) => b.date)).toEqual(["2026-11-12", "2026-11-09"])
    expect(buckets[0]).toMatchObject({ income: 500000, expense: 90000, net: 410000 })
    expect(buckets[1]).toMatchObject({ income: 200000, expense: 0, net: 200000 })
  })

  it("같은 날 안에서는 최근에 등록한 건이 위에 온다", () => {
    const buckets = buildDayBuckets(entries)
    expect(buckets[0].entries.map((e) => e.id)).toEqual(["b", "d", "a"])
  })

  it("날짜별 합을 다시 더하면 전체 합과 같다", () => {
    const buckets = buildDayBuckets(entries)
    expect(buckets.reduce((sum, b) => sum + b.income, 0)).toBe(700000)
    expect(buckets.reduce((sum, b) => sum + b.expense, 0)).toBe(90000)
  })

  it("건이 없으면 빈 목록이다", () => {
    expect(buildDayBuckets([])).toEqual([])
  })
})

describe("buildWeekBuckets (주별 장부)", () => {
  const rows = [
    sale("2026-11-01", 100),
    sale("2026-11-07", 100),
    sale("2026-11-08", 50),
    spend("2026-11-12", 20),
    sale("2026-11-30", 7),
  ]

  it("7일 단위 주차(1~7, 8~14, …, 29~말일)로 나누고 최근 주차가 먼저다", () => {
    const buckets = buildWeekBuckets("2026-11-15", rows, "2026-11-30")
    expect(buckets.map((b) => [b.from, b.to])).toEqual([
      ["2026-11-29", "2026-11-30"],
      ["2026-11-22", "2026-11-28"],
      ["2026-11-15", "2026-11-21"],
      ["2026-11-08", "2026-11-14"],
      ["2026-11-01", "2026-11-07"],
    ])
  })

  it("주차마다 매출·지출·차액·건수를 구하고 합은 월 전체와 같다", () => {
    const buckets = buildWeekBuckets("2026-11-15", rows, "2026-11-30")
    const week1 = buckets.find((b) => b.key === "2026-11-1")!
    expect(week1).toMatchObject({ income: 200, expense: 0, net: 200, count: 2 })
    const week2 = buckets.find((b) => b.key === "2026-11-2")!
    expect(week2).toMatchObject({ income: 50, expense: 20, net: 30, count: 2 })
    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(rows.length)
  })

  it("오늘 이후에 시작하는 주차는 뺀다", () => {
    const buckets = buildWeekBuckets("2026-11-15", rows, "2026-11-10")
    expect(buckets.map((b) => b.key)).toEqual(["2026-11-2", "2026-11-1"])
  })

  it("2월은 4주차까지이고 윤년 29일은 5주차에 들어간다", () => {
    expect(buildWeekBuckets("2026-02-10", [], "2026-12-31")).toHaveLength(4)
    const leap = buildWeekBuckets("2028-02-10", [sale("2028-02-29", 5)], "2028-12-31")
    expect(leap).toHaveLength(5)
    expect(leap[0]).toMatchObject({ from: "2028-02-29", to: "2028-02-29", income: 5 })
  })

  it("주차 이름: '2주차 11/8~11/14'", () => {
    const week2 = buildWeekBuckets("2026-11-15", [], "2026-11-30").find(
      (b) => b.key === "2026-11-2"
    )!
    expect(formatWeekBucketLabel(week2)).toBe("2주차 11/8~11/14")
  })
})

describe("buildMonthBuckets (월별 장부)", () => {
  const rows = [
    sale("2026-01-15", 100),
    spend("2026-03-02", 30),
    sale("2026-03-31", 10),
    sale("2026-11-12", 500),
  ]

  it("올해는 오늘이 속한 달까지, 최근 달이 먼저다", () => {
    const buckets = buildMonthBuckets(2026, rows, "2026-11-12")
    expect(buckets).toHaveLength(11)
    expect(buckets[0].key).toBe("2026-11")
    expect(buckets[buckets.length - 1].key).toBe("2026-01")
  })

  it("지난 해는 12달 전부 보여 주고 기록 없는 달은 0이다", () => {
    const buckets = buildMonthBuckets(2025, [], "2026-11-12")
    expect(buckets).toHaveLength(12)
    expect(buckets.every((b) => b.income === 0 && b.expense === 0 && b.count === 0)).toBe(true)
  })

  it("달마다 합계를 구한다 (말일 포함)", () => {
    const march = buildMonthBuckets(2026, rows, "2026-11-12").find((b) => b.key === "2026-03")!
    expect(march).toMatchObject({ income: 10, expense: 30, net: -20, count: 2 })
  })

  it("월 이름: '11월'", () => {
    expect(formatMonthBucketLabel(buildMonthBuckets(2026, [], "2026-11-12")[0])).toBe("11월")
  })
})

describe("buildYearBuckets (연별 장부)", () => {
  it("가장 이른 기록의 해부터 올해까지 최근 해가 먼저이고, 기록 없는 해도 0으로 넣는다", () => {
    const buckets = buildYearBuckets(
      [sale("2024-05-01", 10), sale("2026-02-01", 20), spend("2026-03-01", 5)],
      "2026-11-12"
    )
    expect(buckets.map((b) => b.key)).toEqual(["2026", "2025", "2024"])
    expect(buckets[0]).toMatchObject({ income: 20, expense: 5, net: 15, count: 2 })
    expect(buckets[1]).toMatchObject({ income: 0, expense: 0, count: 0 })
  })

  it("기록이 없으면 올해 한 칸만 있다", () => {
    expect(buildYearBuckets([], "2026-11-12").map((b) => b.key)).toEqual(["2026"])
  })
})

describe("parseAnchorDate / getLedgerRange", () => {
  it("올바른 날짜만 받고 잘못된 값은 fallback이다 (없는 날짜 포함)", () => {
    const fallback = "2026-11-12"
    expect(parseAnchorDate("2026-03-05", fallback)).toBe("2026-03-05")
    expect(parseAnchorDate(["2026-03-05", "x"], fallback)).toBe("2026-03-05")
    expect(parseAnchorDate("2026-02-30", fallback)).toBe(fallback)
    expect(parseAnchorDate("2026-13-01", fallback)).toBe(fallback)
    expect(parseAnchorDate("20260305", fallback)).toBe(fallback)
    expect(parseAnchorDate("", fallback)).toBe(fallback)
    expect(parseAnchorDate(undefined, fallback)).toBe(fallback)
  })

  it("일일·주별은 그 달, 월별은 그 해, 연별은 전체 기간이다", () => {
    expect(getLedgerRange("day", "2026-11-12")).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    })
    expect(getLedgerRange("week", "2028-02-10").to).toBe("2028-02-29")
    expect(getLedgerRange("month", "2026-11-12")).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    })
    const all = getLedgerRange("year", "2026-11-12")
    expect(all.from < "2000-01-01" && all.to > "2050-01-01").toBe(true)
  })
})

describe("일일 장부 거르기", () => {
  const entries = [
    { kind: "sale" as const, isUnpaid: true, id: "a" },
    { kind: "sale" as const, isUnpaid: false, id: "b" },
    { kind: "expense" as const, id: "c" },
  ]

  it("전체·매출·지출·미입금으로 거른다", () => {
    const ids = (f: Parameters<typeof filterLedgerEntries>[1]) =>
      filterLedgerEntries(entries, f).map((e) => e.id)
    expect(ids("all")).toEqual(["a", "b", "c"])
    expect(ids("sale")).toEqual(["a", "b"])
    expect(ids("expense")).toEqual(["c"])
    expect(ids("unpaid")).toEqual(["a"])
  })

  it("알 수 없는 값은 전체", () => {
    expect(parseLedgerKind("bogus")).toBe("all")
    expect(parseLedgerKind("unpaid")).toBe("unpaid")
  })
})
