import {
  CAR_EXPENSE_MAJOR,
  CAR_EXPENSE_MINORS,
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
 * 한 차의 차계부 자료 전부: 지출(첫 업무용 차만) + car_logs + 정비 항목 줄 + 교체 주기 표.
 * 정비 항목 줄은 부모(지출·기록)가 지워지지 않은 것만 남긴다(car_service_items엔 deleted_at이 없음).
 */
export async function loadCarLedgerData(
  supabase: Supabase,
  carId: string,
  withExpenses: boolean
): Promise<CarLedgerData> {
  const [expenses, logs, serviceItems, cycles] = await Promise.all([
    withExpenses
      ? fetchAllRows<CarExpenseInput>((a, b) =>
          supabase
            .from("expenses")
            .select(EXPENSE_COLUMNS)
            .is("deleted_at", null)
            .eq("category_major", CAR_EXPENSE_MAJOR)
            .in("category_minor", CAR_EXPENSE_MINORS)
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
    fetchAllRows<ServiceItemInput>((a, b) =>
      supabase
        .from("car_service_items")
        .select("expense_id, car_log_id, item, amount, sort_order")
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

  // 살아 있는 부모에 붙은 줄만
  const expenseIds = new Set(expenses.map((row) => row.id))
  const logIds = new Set(logs.map((row) => row.id))
  const expenseItems = serviceItems.filter((row) => row.expense_id !== null && expenseIds.has(row.expense_id))
  const logItems = serviceItems.filter((row) => row.car_log_id !== null && logIds.has(row.car_log_id))

  return {
    entries: [...expensesToCarEntries(expenses, expenseItems), ...carLogsToEntries(logs, logItems)],
    amountRows: toAmountRows(expenses, logs),
    cycles: cycles.data ?? [],
  }
}
