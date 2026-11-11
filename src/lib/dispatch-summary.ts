import { summarizeDispatches, type ClientDispatchTotals } from "@/lib/dispatch-list"

/** 차량번호도 기사 이름도 비어 있는(차량을 아직 정하지 않은) 배차를 묶는 이름 */
export const UNSET_VEHICLE_LABEL = "차량 미정"

export interface VehicleDispatchTotals {
  /** 차량번호 (없으면 빈 문자열) */
  plate: string
  /** 기사 이름 — 같은 차량의 배차 중 가장 많이 쓰인 이름 (없으면 빈 문자열) */
  driver: string
  count: number
  freightAmount: number
  feeAmount: number
}

export interface DispatchMonthSummary {
  count: number
  /** 운임 합계 (운임을 적지 않은 건은 0으로 본다) */
  freightAmount: number
  feeAmount: number
  /** 거래처별 (건수 많은 순) */
  byClient: ClientDispatchTotals[]
  /**
   * 차량별: 차량번호로 묶는다(차량번호가 없으면 기사 이름으로). 운임이 큰 순, 같으면 건수 많은 순,
   * 그래도 같으면 이름·차량번호 순. 차량번호도 기사 이름도 없는 건("차량 미정")은 맨 뒤.
   */
  byVehicle: VehicleDispatchTotals[]
}

interface SummarizableDispatch {
  client_id: string | null
  plate_no_snapshot: string | null
  driver_name_snapshot: string | null
  freight_amount: number | null
  fee_amount: number
}

/** 한 달 배차를 거래처별·차량별로 묶어 건수·운임·수수료를 구한다 (월간 집계 탭). */
export function summarizeDispatchMonth(
  rows: readonly SummarizableDispatch[]
): DispatchMonthSummary {
  const base = summarizeDispatches(rows)
  const vehicles = new Map<
    string,
    VehicleDispatchTotals & { driverCounts: Map<string, number> }
  >()

  for (const row of rows) {
    const plate = row.plate_no_snapshot?.trim() ?? ""
    const driver = row.driver_name_snapshot?.trim() ?? ""
    // 차량번호가 있으면 차량번호로, 없으면 기사 이름으로 묶는다 (둘 다 없으면 "차량 미정").
    const key = plate ? `plate:${plate}` : driver ? `driver:${driver}` : "unset"

    let entry = vehicles.get(key)
    if (!entry) {
      entry = {
        plate,
        driver: "",
        count: 0,
        freightAmount: 0,
        feeAmount: 0,
        driverCounts: new Map(),
      }
      vehicles.set(key, entry)
    }
    entry.count += 1
    entry.freightAmount += row.freight_amount ?? 0
    entry.feeAmount += row.fee_amount
    if (driver) {
      entry.driverCounts.set(driver, (entry.driverCounts.get(driver) ?? 0) + 1)
    }
  }

  const byVehicle = [...vehicles.values()]
    .map(({ driverCounts, ...entry }) => {
      // 같은 차량에 기사 이름이 여러 개면 가장 많이 쓰인 이름(같으면 먼저 나온 이름)을 보여 준다.
      let driver = ""
      let best = 0
      for (const [name, count] of driverCounts) {
        if (count > best) {
          driver = name
          best = count
        }
      }
      return { ...entry, driver }
    })
    .sort((a, b) => {
      const aUnset = !a.plate && !a.driver
      const bUnset = !b.plate && !b.driver
      if (aUnset !== bUnset) return aUnset ? 1 : -1
      return (
        b.freightAmount - a.freightAmount ||
        b.count - a.count ||
        (a.driver || a.plate).localeCompare(b.driver || b.plate, "ko") ||
        a.plate.localeCompare(b.plate, "ko")
      )
    })

  return {
    count: base.count,
    freightAmount: base.freightAmount,
    feeAmount: base.feeAmount,
    byClient: base.byClient,
    byVehicle,
  }
}
