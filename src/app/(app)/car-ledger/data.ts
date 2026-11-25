import {
  CAR_EXPENSE_MAJOR,
  CAR_EXPENSE_MINORS,
  CAR_SERVICE_MINOR,
} from "@/lib/car-ledger/constants"
import {
  carLogsToEntries,
  expensesToCarEntries,
  toAmountRows,
  type CarAmountRow,
  type CarEntry,
  type CarExpenseInput,
  type CarLogInput,
  type ServiceItemInput,
} from "@/lib/car-ledger/entries"
import type { CycleInput } from "@/lib/car-ledger/stats"
import type { CarItemRow, CarRow } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

import { fetchAllRows } from "../ledger-data"

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
  "id, expense_date, category_minor, amount, installment_group_id, installment_no, installment_months, card_name, liters, odometer_km, vendor, memo"

/**
 * 차계부 정비 기록을 보여 주는 첫날. 그 전 정비 지출은 지출(가계부)에만 남고 차계부에는 안 보인다
 * (사용자 결정 2026-11-25: 예전 정비 기록은 따로 받은 엑셀 목록으로 본다).
 */
export const SERVICE_LEDGER_START = "2026-11-01"

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
  const expenseQuery = () =>
    supabase.from("expenses").select(EXPENSE_COLUMNS).is("deleted_at", null).eq("category_major", CAR_EXPENSE_MAJOR)
  const otherMinors = CAR_EXPENSE_MINORS.filter((minor) => minor !== CAR_SERVICE_MINOR)

  const [serviceExpenses, otherExpenses, logs, cycles] = await Promise.all([
    withExpenses
      ? fetchAllRows<CarExpenseInput>((a, b) =>
          expenseQuery()
            .eq("category_minor", CAR_SERVICE_MINOR)
            .gte("expense_date", SERVICE_LEDGER_START)
            .order("expense_date")
            .order("id")
            .range(a, b)
        )
      : Promise.resolve([] as CarExpenseInput[]),
    withExpenses
      ? fetchAllRows<CarExpenseInput>((a, b) =>
          expenseQuery()
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
