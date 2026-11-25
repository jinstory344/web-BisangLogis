import {
  CAR_EXPENSE_MAJOR,
  CAR_EXPENSE_MINORS,
  CAR_SERVICE_MINOR,
} from "@/lib/car-ledger/constants"
import {
  carLogsToEntries,
  expenseKindOf,
  expensesToCarEntries,
  toAmountRows,
  type CarAmountRow,
  type CarEntry,
  type CarExpenseInput,
  type CarLogInput,
  type ServiceItemInput,
} from "@/lib/car-ledger/entries"
import type { CycleInput } from "@/lib/car-ledger/stats"
import { expensePaymentLabel } from "@/lib/constants/payment-method"
import type { CarExportRow } from "@/lib/excel-export"
import type { CarItemRow, CarRow } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

import { fetchAllRows } from "../ledger-data"

import type { HistoryRow } from "./history-tab"

type Supabase = Awaited<ReturnType<typeof createClient>>

export interface CarLedgerMasters {
  cars: CarRow[]
  /** 정비 세부 항목 이름 (순서대로) */
  serviceItems: CarItemRow[]
  /** 승용차 기록 종류 (순서대로) */
  logKinds: CarItemRow[]
  /** 차계부 표를 못 읽었을 때 (마이그레이션 전 등) */
  error: string | null
}

/** 차 목록 + 항목 목록 */
export async function loadCarMasters(supabase: Supabase): Promise<CarLedgerMasters> {
  const [cars, items] = await Promise.all([
    supabase.from("cars").select("*").is("deleted_at", null).order("sort_order").order("created_at"),
    supabase.from("car_items").select("*").is("deleted_at", null).order("sort_order").order("name"),
  ])
  const error = cars.error?.message ?? items.error?.message ?? null
  const itemRows = items.data ?? []
  return {
    cars: cars.data ?? [],
    serviceItems: itemRows.filter((row) => row.kind === "service"),
    logKinds: itemRows.filter((row) => row.kind === "log"),
    error,
  }
}

/** 지출이 이어지는 차: 첫 업무용 차 (업무용 차가 1대라는 전제 — 2대가 되면 expenses.car_id 필요) */
export function primaryBusinessCarId(cars: readonly CarRow[]): string | null {
  return cars.find((car) => car.kind === "business")?.id ?? null
}

export interface CarLedgerData {
  /** 전체 기간 기록 (할부 묶음은 하나) */
  entries: CarEntry[]
  /** 달·올해 합계용 줄 (할부는 회차 줄) */
  amountRows: CarAmountRow[]
  cycles: CycleInput[]
}

const EXPENSE_COLUMNS =
  "id, expense_date, category_minor, amount, installment_group_id, installment_no, installment_months, card_name, payment_method, liters, odometer_km, vendor, memo"

/**
 * 차계부 정비 기록을 보여 주는 첫날. 그 전 정비 지출은 지출(가계부)에만 남고 차계부에는 안 보인다
 * (사용자 결정 2026-11-25: 예전 정비 기록은 따로 받은 엑셀 목록으로 본다).
 */
export const SERVICE_LEDGER_START = "2026-11-01"

/**
 * 이 시각 뒤에 새로 넣거나 고친 정비 지출은 날짜가 SERVICE_LEDGER_START 전이어도 차계부에 보인다
 * (사용자 요청 2026-11-25: "지금부터 직접 입력하거나 수정한 건 이전 달에도"). 예전 자료 정리 작업이 끝난 직후 시각.
 * shortcut: updated_at 기준이라 예전 정비 지출을 스크립트로 일괄 수정하면 그 줄들도 보이게 된다 — 그럴 땐 표시용 칸을 따로 둘 것.
 */
export const SERVICE_LEDGER_EDITED_SINCE = "2026-11-25T12:15:00Z"

function carExpenseQuery(supabase: Supabase) {
  return supabase
    .from("expenses")
    .select(EXPENSE_COLUMNS)
    .is("deleted_at", null)
    .eq("category_major", CAR_EXPENSE_MAJOR)
}

/**
 * 차계부에 보이는 정비 지출: SERVICE_LEDGER_START부터, 또는 SERVICE_LEDGER_EDITED_SINCE 뒤에 넣거나 고친 것.
 * 할부 묶음의 일부만 읽혔으면(시작일 전에 시작한 할부 등) 묶음 전체를 함께 읽는다(항목 줄은 1회차에 붙어 있음).
 * 일일(탭) 화면과 달력·주별·월별·연별 보기가 같은 규칙을 쓰도록 한곳에 둔다.
 */
async function loadServiceExpenses(supabase: Supabase): Promise<CarExpenseInput[]> {
  const serviceExpenses = await fetchAllRows<CarExpenseInput>((a, b) =>
    carExpenseQuery(supabase)
      .eq("category_minor", CAR_SERVICE_MINOR)
      .or(
        `expense_date.gte.${SERVICE_LEDGER_START},created_at.gte.${SERVICE_LEDGER_EDITED_SINCE},updated_at.gte.${SERVICE_LEDGER_EDITED_SINCE}`
      )
      .order("expense_date")
      .order("id")
      .range(a, b)
  )

  const groupIds = [
    ...new Set(serviceExpenses.map((row) => row.installment_group_id).filter((id): id is string => !!id)),
  ]
  if (groupIds.length) {
    const earlier = await fetchAllRows<CarExpenseInput>((a, b) =>
      carExpenseQuery(supabase)
        .eq("category_minor", CAR_SERVICE_MINOR)
        .in("installment_group_id", groupIds)
        .order("expense_date")
        .order("id")
        .range(a, b)
    )
    const seen = new Set(serviceExpenses.map((row) => row.id))
    serviceExpenses.push(...earlier.filter((row) => !seen.has(row.id)))
  }
  return serviceExpenses
}

/**
 * 달력·주별·월별·연별 보기용: 한 차의 비용 줄(날짜·종류·금액)만 from~to로 읽는다 — 차계부 달 합계와 같은 기준
 * (지출은 첫 업무용 차만, 정비는 loadServiceExpenses 규칙, 할부는 회차 줄 금액).
 */
export async function loadCarAmountRows(
  supabase: Supabase,
  carId: string,
  withExpenses: boolean,
  from: string,
  to: string
): Promise<CarAmountRow[]> {
  const otherMinors = CAR_EXPENSE_MINORS.filter((minor) => minor !== CAR_SERVICE_MINOR)
  const [serviceExpenses, otherExpenses, logs] = await Promise.all([
    withExpenses ? loadServiceExpenses(supabase) : Promise.resolve([] as CarExpenseInput[]),
    withExpenses
      ? fetchAllRows((a, b) =>
          supabase
            .from("expenses")
            .select("expense_date, category_minor, amount")
            .is("deleted_at", null)
            .eq("category_major", CAR_EXPENSE_MAJOR)
            .in("category_minor", otherMinors)
            .gte("expense_date", from)
            .lte("expense_date", to)
            .order("expense_date")
            .order("id")
            .range(a, b)
        )
      : Promise.resolve([]),
    fetchAllRows((a, b) =>
      supabase
        .from("car_logs")
        .select("log_date, kind, amount")
        .eq("car_id", carId)
        .is("deleted_at", null)
        .gte("log_date", from)
        .lte("log_date", to)
        .order("log_date")
        .order("id")
        .range(a, b)
    ),
  ])

  return [
    ...serviceExpenses,
    ...otherExpenses,
  ]
    .map((row) => ({ date: row.expense_date, kind: expenseKindOf(row.category_minor), amount: Number(row.amount) }))
    .concat(logs.map((row) => ({ date: row.log_date, kind: row.kind, amount: Number(row.amount) })))
    .filter((row) => row.date >= from && row.date <= to)
}

/**
 * 한 차의 차계부 자료: 지출(첫 업무용 차만 — 정비는 SERVICE_LEDGER_START부터, 주유·요소수는 고른 해만)
 * + car_logs + 그 기록들에 붙은 정비 항목 줄 + 교체 주기 표.
 * 탭·달을 옮길 때마다 다시 읽으므로 필요한 만큼만 읽는다(예전엔 2022년부터 전부 읽어 느렸음).
 */
export async function loadCarLedgerData(
  supabase: Supabase,
  carId: string,
  withExpenses: boolean,
  year: string
): Promise<CarLedgerData> {
  const otherMinors = CAR_EXPENSE_MINORS.filter((minor) => minor !== CAR_SERVICE_MINOR)

  const [serviceExpenses, otherExpenses, logs, cycles] = await Promise.all([
    withExpenses ? loadServiceExpenses(supabase) : Promise.resolve([] as CarExpenseInput[]),
    withExpenses
      ? fetchAllRows<CarExpenseInput>((a, b) =>
          carExpenseQuery(supabase)
            .in("category_minor", otherMinors)
            .gte("expense_date", `${year}-01-01`)
            .lte("expense_date", `${year}-12-31`)
            .order("expense_date")
            .order("id")
            .range(a, b)
        )
      : Promise.resolve([] as CarExpenseInput[]),
    fetchAllRows<CarLogInput>((a, b) =>
      supabase
        .from("car_logs")
        .select("id, log_date, kind, amount, liters, odometer_km, vendor, memo")
        .eq("car_id", carId)
        .is("deleted_at", null)
        .order("log_date")
        .order("id")
        .range(a, b)
    ),
    supabase
      .from("car_item_cycles")
      .select("id, item, cycle_km, manual_date, manual_km, sort_order")
      .eq("car_id", carId)
      .is("deleted_at", null)
      .order("sort_order"),
  ])

  // 정비 항목 줄은 위에서 읽은 기록(살아 있는 부모)에 붙은 것만 읽는다
  const expenseIds = serviceExpenses.map((row) => row.id)
  const logIds = logs.map((row) => row.id)
  const [expenseItems, logItems] = await Promise.all([
    expenseIds.length
      ? fetchAllRows<ServiceItemInput>((a, b) =>
          supabase
            .from("car_service_items")
            .select("expense_id, car_log_id, item, amount, sort_order")
            .in("expense_id", expenseIds)
            .order("id")
            .range(a, b)
        )
      : Promise.resolve([] as ServiceItemInput[]),
    logIds.length
      ? fetchAllRows<ServiceItemInput>((a, b) =>
          supabase
            .from("car_service_items")
            .select("expense_id, car_log_id, item, amount, sort_order")
            .in("car_log_id", logIds)
            .order("id")
            .range(a, b)
        )
      : Promise.resolve([] as ServiceItemInput[]),
  ])

  const expenses = [...serviceExpenses, ...otherExpenses]
  return {
    entries: [...expensesToCarEntries(expenses, expenseItems), ...carLogsToEntries(logs, logItems)],
    amountRows: toAmountRows(expenses, logs),
    cycles: cycles.data ?? [],
  }
}

/** 11월 이전 정비 기록(엑셀에서 옮긴 것) — 날짜 순서대로. 표가 없거나 못 읽으면 빈 목록. */
export async function loadServiceHistory(supabase: Supabase, carId: string): Promise<HistoryRow[]> {
  const { data, error } = await supabase
    .from("car_service_history")
    .select("id, service_date, odometer_km, content, amount, vendor")
    .eq("car_id", carId)
    .is("deleted_at", null)
    .order("service_date")
    .order("sort_order")
  return error ? [] : (data ?? [])
}

/**
 * 엑셀 내보내기용 차계부 줄: 모든 차의 기록을 기간 안에서(없으면 전체) 한 줄씩.
 * 업무용 트럭은 차계부 화면과 같은 규칙의 지출(정비·주유비·요소수, 할부는 회차 줄마다), 그 밖의 차는 car_logs.
 */
export async function loadCarExportRows(
  supabase: Supabase,
  period: { from: string; to: string } | null
): Promise<{ rows: CarExportRow[]; history: { car: string; service_date: string; odometer_km: number | null; content: string; amount: number | null; vendor: string | null }[] }> {
  const { cars } = await loadCarMasters(supabase)
  const nameOf = new Map(cars.map((car) => [car.id, car.plate_no ? `${car.name} ${car.plate_no}` : car.name]))
  const truckId = primaryBusinessCarId(cars)
  const inPeriod = (date: string) => !period || (date >= period.from && date <= period.to)
  const otherMinors = CAR_EXPENSE_MINORS.filter((minor) => minor !== CAR_SERVICE_MINOR)

  const [serviceExpenses, otherExpenses, logs, historyRes] = await Promise.all([
    truckId ? loadServiceExpenses(supabase) : Promise.resolve([] as CarExpenseInput[]),
    truckId
      ? fetchAllRows<CarExpenseInput>((a, b) => {
          let q = carExpenseQuery(supabase).in("category_minor", otherMinors)
          if (period) q = q.gte("expense_date", period.from).lte("expense_date", period.to)
          return q.order("expense_date").order("id").range(a, b)
        })
      : Promise.resolve([] as CarExpenseInput[]),
    fetchAllRows<CarLogInput & { car_id: string }>((a, b) => {
      let q = supabase
        .from("car_logs")
        .select("id, car_id, log_date, kind, amount, liters, odometer_km, vendor, memo")
        .is("deleted_at", null)
      if (period) q = q.gte("log_date", period.from).lte("log_date", period.to)
      return q.order("log_date").order("id").range(a, b)
    }),
    (() => {
      let q = supabase
        .from("car_service_history")
        .select("car_id, service_date, odometer_km, content, amount, vendor, sort_order")
        .is("deleted_at", null)
      if (period) q = q.gte("service_date", period.from).lte("service_date", period.to)
      return q.order("service_date").order("sort_order")
    })(),
  ])

  const expenses = [...serviceExpenses.filter((row) => inPeriod(row.expense_date)), ...otherExpenses]
  const expenseIds = serviceExpenses.map((row) => row.id)
  const logIds = logs.map((row) => row.id)
  const [expenseItems, logItems] = await Promise.all([
    expenseIds.length
      ? fetchAllRows<ServiceItemInput>((a, b) =>
          supabase.from("car_service_items").select("expense_id, car_log_id, item, amount, sort_order").in("expense_id", expenseIds).order("id").range(a, b)
        )
      : Promise.resolve([] as ServiceItemInput[]),
    logIds.length
      ? fetchAllRows<ServiceItemInput>((a, b) =>
          supabase.from("car_service_items").select("expense_id, car_log_id, item, amount, sort_order").in("car_log_id", logIds).order("id").range(a, b)
        )
      : Promise.resolve([] as ServiceItemInput[]),
  ])
  // 정비 항목은 할부 1회차에 붙어 있으므로 묶음(installment_group_id)으로도 찾는다
  const firstOfGroup = new Map<string, string>()
  for (const row of serviceExpenses) {
    if (row.installment_group_id && row.installment_no === 1) firstOfGroup.set(row.installment_group_id, row.id)
  }
  const itemText = (list: ServiceItemInput[], parentId: string, key: "expense_id" | "car_log_id") =>
    list
      .filter((line) => line[key] === parentId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((line) => (line.amount !== null ? `${line.item} ${line.amount.toLocaleString("ko-KR")}` : line.item))
      .join(", ")

  const truckName = truckId ? (nameOf.get(truckId) ?? "") : ""
  const rows: CarExportRow[] = [
    ...expenses.map((row) => ({
      car: truckName,
      date: row.expense_date,
      kind: expenseKindOf(row.category_minor),
      items: itemText(expenseItems, (row.installment_group_id && firstOfGroup.get(row.installment_group_id)) || row.id, "expense_id"),
      amount: Number(row.amount),
      liters: row.liters === null ? null : Number(row.liters),
      km: row.odometer_km,
      vendor: row.vendor,
      payment: expensePaymentLabel({ ...row, payment_method: row.payment_method ?? null }),
      memo: row.memo,
    })),
    ...logs.map((row) => ({
      car: nameOf.get(row.car_id) ?? "",
      date: row.log_date,
      kind: row.kind,
      items: itemText(logItems, row.id, "car_log_id"),
      amount: Number(row.amount),
      liters: row.liters === null ? null : Number(row.liters),
      km: row.odometer_km,
      vendor: row.vendor,
      payment: "",
      memo: row.memo,
    })),
  ].sort((a, b) => a.car.localeCompare(b.car) || a.date.localeCompare(b.date))

  const history = (historyRes.data ?? []).map((row) => ({ ...row, car: nameOf.get(row.car_id) ?? "" }))
  return { rows, history }
}
