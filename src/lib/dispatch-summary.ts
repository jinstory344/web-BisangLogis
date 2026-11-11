import { summarizeDispatches, type ClientDispatchTotals } from "@/lib/dispatch-list"

/** 기사 이름이 비어 있는(차량을 아직 정하지 않은) 배차를 묶는 이름 */
export const UNSET_DRIVER_LABEL = "기사 미정"

export interface DriverDispatchTotals {
  /** 화면에 보여 줄 이름 (기사 이름, 없으면 "기사 미정") */
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
  /** 기사별: 운임이 큰 순, 같으면 건수 많은 순, 그래도 같으면 이름 순. "기사 미정"은 맨 뒤. */
  byDriver: DriverDispatchTotals[]
}

interface SummarizableDispatch {
  client_id: string | null
  driver_name_snapshot: string | null
  freight_amount: number | null
  fee_amount: number
}

/** 한 달 배차를 거래처별·기사별로 묶어 건수·운임·수수료를 구한다 (월간 집계 탭). */
export function summarizeDispatchMonth(
  rows: readonly SummarizableDispatch[]
): DispatchMonthSummary {
  const base = summarizeDispatches(rows)
  const drivers = new Map<string, DriverDispatchTotals>()

  for (const row of rows) {
    const driver = row.driver_name_snapshot?.trim() || UNSET_DRIVER_LABEL
    let entry = drivers.get(driver)
    if (!entry) {
      entry = { driver, count: 0, freightAmount: 0, feeAmount: 0 }
      drivers.set(driver, entry)
    }
    entry.count += 1
    entry.freightAmount += row.freight_amount ?? 0
    entry.feeAmount += row.fee_amount
  }

  const byDriver = [...drivers.values()].sort((a, b) => {
    if (a.driver === UNSET_DRIVER_LABEL) return 1
    if (b.driver === UNSET_DRIVER_LABEL) return -1
    return (
      b.freightAmount - a.freightAmount ||
      b.count - a.count ||
      a.driver.localeCompare(b.driver, "ko")
    )
  })

  return {
    count: base.count,
    freightAmount: base.freightAmount,
    feeAmount: base.feeAmount,
    byClient: base.byClient,
    byDriver,
  }
}
