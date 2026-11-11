export interface ClientDispatchTotals {
  clientId: string
  count: number
  freightAmount: number
  feeAmount: number
}

export interface DispatchSummary {
  count: number
  /** 운임 합계 (운임을 적지 않은 건은 0으로 본다) */
  freightAmount: number
  feeAmount: number
  /** 거래처별 건수·운임·수수료. 건수가 많은 순, 같으면 운임이 큰 순, 그래도 같으면 id 순. 거래처가 없는 건은 뺀다. */
  byClient: ClientDispatchTotals[]
}

interface SummarizableDispatch {
  client_id: string | null
  freight_amount: number | null
  fee_amount: number
}

/** 배차 행들의 전체 건수·운임·수수료 합계와 거래처별 합계 (모바일 목록 상단 요약·거래처 칩) */
export function summarizeDispatches(
  rows: readonly SummarizableDispatch[]
): DispatchSummary {
  const byClient = new Map<string, ClientDispatchTotals>()
  let count = 0
  let freightAmount = 0
  let feeAmount = 0

  for (const row of rows) {
    const freight = row.freight_amount ?? 0
    count += 1
    freightAmount += freight
    feeAmount += row.fee_amount

    if (!row.client_id) continue
    let entry = byClient.get(row.client_id)
    if (!entry) {
      entry = { clientId: row.client_id, count: 0, freightAmount: 0, feeAmount: 0 }
      byClient.set(row.client_id, entry)
    }
    entry.count += 1
    entry.freightAmount += freight
    entry.feeAmount += row.fee_amount
  }

  return {
    count,
    freightAmount,
    feeAmount,
    byClient: [...byClient.values()].sort(
      (a, b) =>
        b.count - a.count ||
        b.freightAmount - a.freightAmount ||
        a.clientId.localeCompare(b.clientId)
    ),
  }
}

/** 거래처로 거른다 (빈 문자열이면 거르지 않는다). */
export function filterDispatchesByClient<T extends { client_id: string | null }>(
  rows: readonly T[],
  clientId: string
): T[] {
  return clientId ? rows.filter((row) => row.client_id === clientId) : [...rows]
}

/** 거래처 칩으로 보여 줄 최대 개수 (건수가 많은 앞쪽부터, 선택된 거래처는 따로 덧붙인다) */
export const DISPATCH_CLIENT_CHIP_LIMIT = 6

/**
 * 거래처 칩 목록: 건수가 많은 앞쪽 limit곳. 선택된 거래처가 그 밖에 있으면 선택이 사라져 보이지 않도록
 * 뒤에 덧붙인다 (그 거래처의 이번 기간 배차가 없어도 선택돼 있으면 보여 준다).
 */
export function pickClientChips(
  byClient: readonly ClientDispatchTotals[],
  selectedClientId: string,
  limit = DISPATCH_CLIENT_CHIP_LIMIT
): ClientDispatchTotals[] {
  const shown = byClient.slice(0, limit)
  if (!selectedClientId || shown.some((c) => c.clientId === selectedClientId)) {
    return shown
  }
  const selected = byClient.find((c) => c.clientId === selectedClientId) ?? {
    clientId: selectedClientId,
    count: 0,
    freightAmount: 0,
    feeAmount: 0,
  }
  return [...shown, selected]
}
