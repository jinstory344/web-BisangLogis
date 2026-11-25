import { describe, expect, it } from "vitest"

import { carDayPeriod } from "./car-ledger/url"
import {
  dispatchMetricRows,
  expenseMetricRows,
  rowsInPeriod,
  SALE_METRIC_KEYS,
  saleMetricRows,
} from "./period-metrics"
import {
  bucketTarget,
  buildDailySums,
  buildPeriodBuckets,
  getViewRange,
  listAnchor,
  listViewHref,
  monthRanges,
  periodBadge,
  periodTitle,
  previousPeriod,
  sumPeriod,
  viewAnchorHref,
  viewNeighborHrefs,
  viewPickerSpec,
  weekRanges,
  yearRanges,
  type MetricRow,
} from "./period-view"
import { summarizeByPaymentStatus } from "./sales-list"
import { formatChangeRate } from "./summary"

const TODAY = "2026-11-25"

describe("기간 칸 나누기", () => {
  it("주별: 그 달을 7일씩, 오늘 이후에 시작하는 주는 빼고 최근 주가 먼저", () => {
    expect(weekRanges("2026-11-10", TODAY)).toEqual([
      { key: "2026-11-4", from: "2026-11-22", to: "2026-11-28" },
      { key: "2026-11-3", from: "2026-11-15", to: "2026-11-21" },
      { key: "2026-11-2", from: "2026-11-08", to: "2026-11-14" },
      { key: "2026-11-1", from: "2026-11-01", to: "2026-11-07" },
    ])
    // 지난 달은 5주차(29~31일)까지
    expect(weekRanges("2026-10-01", TODAY)[0]).toEqual({ key: "2026-10-5", from: "2026-10-29", to: "2026-10-31" })
  })

  it("월별: 올해는 이번 달까지, 지난해는 12달", () => {
    expect(monthRanges(2026, TODAY).map((r) => r.key)).toEqual(
      ["11", "10", "09", "08", "07", "06", "05", "04", "03", "02", "01"].map((m) => `2026-${m}`)
    )
    expect(monthRanges(2025, TODAY)).toHaveLength(12)
    expect(monthRanges(2024, TODAY)[11]).toEqual({ key: "2024-01", from: "2024-01-01", to: "2024-01-31" })
  })

  it("연별: 가장 이른 기록의 해부터 올해까지 (기록 없으면 올해만)", () => {
    expect(yearRanges(["2024-03-01", "2026-01-01"], TODAY).map((r) => r.key)).toEqual(["2026", "2025", "2024"])
    expect(yearRanges([], TODAY).map((r) => r.key)).toEqual(["2026"])
  })
})

describe("칸별 합계", () => {
  const rows: MetricRow<"amount" | "fee">[] = [
    { date: "2026-11-01", amount: 100, fee: 1 },
    { date: "2026-11-07", amount: 50, fee: 0 },
    { date: "2026-11-08", amount: 30, fee: 2 },
    { date: "2026-10-31", amount: 999, fee: 9 },
  ]

  it("sumPeriod는 양끝 날짜를 포함해 줄 수·금액을 센다", () => {
    expect(sumPeriod(rows, ["amount", "fee"], "2026-11-01", "2026-11-07")).toEqual({
      count: 2,
      sums: { amount: 150, fee: 1 },
    })
  })

  it("주별 칸 합 = 그 달 합 (금액 규칙: 표시 합계와 개별 건 합계가 같다)", () => {
    const buckets = buildPeriodBuckets("week", "2026-11-01", rows, ["amount"], TODAY)
    const monthTotal = sumPeriod(rows, ["amount"], "2026-11-01", "2026-11-30").sums.amount
    expect(buckets.reduce((sum, b) => sum + b.sums.amount, 0)).toBe(monthTotal)
    expect(buckets.find((b) => b.key === "2026-11-2")).toMatchObject({ count: 1, sums: { amount: 30 } })
  })

  it("월별·연별 칸", () => {
    const months = buildPeriodBuckets("month", "2026-01-01", rows, ["amount"], TODAY)
    expect(months.find((b) => b.key === "2026-10")?.sums.amount).toBe(999)
    const years = buildPeriodBuckets("year", "2026-01-01", rows, ["amount"], TODAY)
    expect(years).toEqual([{ key: "2026", from: "2026-01-01", to: "2026-12-31", count: 4, sums: { amount: 1179 } }])
  })

  it("달력: 날짜마다 합계", () => {
    const byDate = buildDailySums(rows, ["amount"])
    expect(byDate["2026-11-01"]).toEqual({ count: 1, sums: { amount: 100 } })
    expect(byDate["2026-11-02"]).toBeUndefined()
  })
})

describe("보기 기간·글자", () => {
  it("보기가 다루는 기간은 HOME과 같다", () => {
    expect(getViewRange("calendar", "2026-11-01")).toEqual({ from: "2026-11-01", to: "2026-11-30" })
    expect(getViewRange("month", "2026-11-01")).toEqual({ from: "2026-01-01", to: "2026-12-31" })
    expect(getViewRange("year", "2026-11-01").from).toBe("1970-01-01")
  })

  it("집계 카드 제목·배지", () => {
    expect(periodTitle("calendar", "2026-11-01")).toBe("2026년 11월")
    expect(periodTitle("month", "2026-11-01")).toBe("2026년")
    expect(periodTitle("year", "2026-11-01")).toBe("전체 기간")
    expect(periodBadge("week", "2026-11-01")).toBe("11월")
    expect(periodBadge("month", "2026-11-01")).toBe("2026년")
    expect(periodBadge("year", "2026-11-01")).toBe("")
  })

  it("비교 기간: 달력=지난 달, 월별=작년, 나머지 없음", () => {
    expect(previousPeriod("calendar", "2026-01-01")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
      label: "지난 달",
      rateWord: "전월",
    })
    expect(previousPeriod("month", "2026-11-01")).toMatchObject({ from: "2025-01-01", to: "2025-12-31", label: "작년" })
    expect(previousPeriod("year", "2026-11-01")).toBeNull()
    expect(previousPeriod("week", "2026-11-01")).toBeNull()
  })

  it("달력 아이콘: 달 고르기(달 숫자) / 월별은 해 고르기(26) / 연별은 없음", () => {
    expect(viewPickerSpec("calendar", "2026-11-01")).toEqual({ mode: "month", iconText: "11", label: "2026년 11월" })
    expect(viewPickerSpec("month", "2026-01-01")).toEqual({ mode: "year", iconText: "26", label: "2026년" })
    expect(viewPickerSpec("year", "2026-01-01")).toBeNull()
  })

  it("기준일: from, 전체 기간·잘못된 값이면 이번 달", () => {
    expect(listAnchor("2026-10-01", "2026-10-31", "2026-11-01")).toBe("2026-10-01")
    expect(listAnchor("1970-01-01", "2099-12-31", "2026-11-01")).toBe("2026-11-01")
    expect(listAnchor("", "", "2026-11-01")).toBe("2026-11-01")
  })
})

describe("보기 주소", () => {
  const params = { from: "2026-11-01", to: "2026-11-30", source_major: "거래처", page: "2", view: "calendar" }

  it("거르기는 남기고 page는 지우며, 일일은 view 없이", () => {
    expect(listViewHref("/sales", params, { view: "day", from: "2026-11-08", to: "2026-11-14" })).toBe(
      "/sales?source_major=%EA%B1%B0%EB%9E%98%EC%B2%98&from=2026-11-08&to=2026-11-14"
    )
    expect(viewAnchorHref("/sales", params, "week", "2026-10-15")).toBe(
      "/sales?source_major=%EA%B1%B0%EB%9E%98%EC%B2%98&view=week&from=2026-10-01&to=2026-10-31"
    )
  })

  it("쓸어 넘기기: 달력·주별은 달, 월별은 해, 연별은 없음", () => {
    expect(viewNeighborHrefs("/expenses", {}, "calendar", "2026-01-01")).toEqual({
      prev: "/expenses?view=calendar&from=2025-12-01&to=2025-12-31",
      next: "/expenses?view=calendar&from=2026-02-01&to=2026-02-28",
    })
    expect(viewNeighborHrefs("/expenses", {}, "month", "2026-11-01")?.prev).toBe(
      "/expenses?view=month&from=2025-01-01&to=2025-01-31"
    )
    expect(viewNeighborHrefs("/expenses", {}, "year", "2026-11-01")).toBeNull()
  })

  it("줄·칸 누르기: 날짜·주·달 → 그 기간 일일, 해 → 그 해 월별", () => {
    expect(bucketTarget("calendar", { from: "2026-11-03", to: "2026-11-03" })).toEqual({
      view: "day",
      from: "2026-11-03",
      to: "2026-11-03",
    })
    expect(bucketTarget("month", { from: "2026-10-01", to: "2026-10-31" })).toEqual({
      view: "day",
      from: "2026-10-01",
      to: "2026-10-31",
    })
    expect(bucketTarget("year", { from: "2025-01-01", to: "2025-12-31" })).toEqual({
      view: "month",
      from: "2025-01-01",
      to: "2025-01-31",
    })
  })
})

describe("화면별 금액 줄", () => {
  it("매출: 공급가액을 입금·미입금으로 나눠도 목록 요약과 같다", () => {
    const sales = [
      { sale_date: "2026-11-01", supply_amount: 100000, total_amount: 110000, payment_status: "PAID" as const },
      { sale_date: "2026-11-02", supply_amount: 50000, total_amount: 55000, payment_status: "UNPAID" as const },
    ]
    const sums = sumPeriod(saleMetricRows(sales), SALE_METRIC_KEYS, "2026-11-01", "2026-11-30").sums
    const summary = summarizeByPaymentStatus(sales)
    expect(sums).toEqual({
      supply: summary.all.supplyAmount,
      paid: summary.paid.supplyAmount,
      unpaid: summary.unpaid.supplyAmount,
    })
  })

  it("지출·배차 (운임 없음은 0)", () => {
    expect(expenseMetricRows([{ expense_date: "2026-11-01", amount: 7 }])).toEqual([{ date: "2026-11-01", amount: 7 }])
    expect(dispatchMetricRows([{ dispatch_date: "2026-11-01", freight_amount: null, fee_amount: 3 }])).toEqual([
      { date: "2026-11-01", freight: 0, fee: 3 },
    ])
  })

  it("rowsInPeriod", () => {
    const rows = [{ d: "2026-10-31" }, { d: "2026-11-01" }]
    expect(rowsInPeriod(rows, (r) => r.d, "2026-11-01", "2026-11-30")).toEqual([{ d: "2026-11-01" }])
  })
})

describe("비교 문구", () => {
  it("작년 대비", () => {
    expect(formatChangeRate(120, 100, "매출", "작년")).toBe("작년 대비 +20%")
    expect(formatChangeRate(10, 0, "매출", "작년")).toBe("작년 매출 없음")
    expect(formatChangeRate(80, 100)).toBe("전월 대비 -20%")
  })
})

describe("차계부 일일 기간", () => {
  it("보통은 그 달 전체, 같은 달 안의 짧은 기간은 그대로", () => {
    expect(carDayPeriod("2026-11-01", "2026-11-30", "2026-11-01")).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
      isMonth: true,
      label: "11월",
    })
    expect(carDayPeriod("2026-11-08", "2026-11-14", "2026-11-01")).toEqual({
      from: "2026-11-08",
      to: "2026-11-14",
      isMonth: false,
      label: "11/8~11/14",
    })
    expect(carDayPeriod("2026-11-03", "2026-11-03", "2026-11-01").label).toBe("11/3")
  })

  it("다른 달로 넘어가거나(예전 1년치 주소) 잘못된 값이면 그 달 전체", () => {
    expect(carDayPeriod("2026-01-01", "2026-12-31", "2026-11-01")).toMatchObject({
      from: "2026-01-01",
      to: "2026-01-31",
      isMonth: true,
    })
    expect(carDayPeriod("bad", "", "2026-11-01")).toMatchObject({ from: "2026-11-01", to: "2026-11-30" })
  })
})

describe("앞날짜 기록 (오늘 뒤에 미리 넣은 지출 등)", () => {
  // 실제 사례: 2026-11-30 하이패스 820,160원을 11-25에 미리 넣음 → 5주차(29~30일)가 빠지면 주별 합 ≠ 달 합
  it("오늘 뒤 칸도 기록이 있으면 보여서 칸 합 = 기간 합", () => {
    const rows: MetricRow<"amount">[] = [
      { date: "2026-11-03", amount: 100 },
      { date: "2026-11-30", amount: 820160 },
    ]
    const weeks = buildPeriodBuckets("week", "2026-11-01", rows, ["amount"], TODAY)
    expect(weeks[0]).toMatchObject({ key: "2026-11-5", count: 1, sums: { amount: 820160 } })
    expect(weeks.reduce((sum, b) => sum + b.sums.amount, 0)).toBe(820260)

    const months = buildPeriodBuckets("month", "2026-01-01", [{ date: "2026-12-15", amount: 5 }], ["amount"], TODAY)
    expect(months[0]).toMatchObject({ key: "2026-12", sums: { amount: 5 } })
    const years = buildPeriodBuckets("year", "2026-01-01", [{ date: "2027-01-02", amount: 7 }], ["amount"], TODAY)
    expect(years.map((b) => b.key)).toEqual(["2027", "2026"])
  })

  it("기록이 없으면 지금처럼 오늘 뒤 칸은 없다", () => {
    expect(buildPeriodBuckets("week", "2026-11-01", [], ["amount"], TODAY).map((b) => b.key)).not.toContain("2026-11-5")
  })
})
