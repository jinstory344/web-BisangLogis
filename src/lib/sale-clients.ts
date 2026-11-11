import type { TaxInfoStatus } from "@/lib/client-tax-info"
import type { ClientCategory } from "@/lib/supabase/database.types"

/**
 * 매출 폼 "출처 = 거래처" 소분류에서 고를 수 있는 거래처 한 곳.
 * 세금계산서 정보 상태만 담고 사업자번호 같은 원본 값은 화면에 넘기지 않는다.
 */
export interface SaleClientChoice {
  id: string
  name: string
  category: ClientCategory
  taxStatus: TaxInfoStatus
}

/** 소분류 칩으로 바로 보여 주는 거래처 최대 개수. 나머지는 "다른 거래처 찾기"로 찾는다. */
export const SALE_CLIENT_CHIP_LIMIT = 8

/**
 * 매출에서 많이 쓴 거래처부터, 같으면 이름 가나다순으로 정렬한다.
 * usage는 거래처 id → 삭제되지 않은 매출 건수. 매출에 한 번도 안 쓴 거래처는 뒤로 간다.
 */
export function rankSaleClientChoices(
  choices: readonly SaleClientChoice[],
  usage: ReadonlyMap<string, number>
): SaleClientChoice[] {
  return [...choices].sort((a, b) => {
    const byUsage = (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0)
    return byUsage !== 0 ? byUsage : a.name.localeCompare(b.name, "ko")
  })
}

/**
 * 칩으로 보여 줄 거래처를 고른다: 정렬된 앞쪽 limit곳. 선택된 거래처가 그 밖에 있으면
 * 선택한 것이 사라져 보이지 않도록 맨 뒤에 덧붙인다.
 */
export function pickDisplayedSaleClients(
  ranked: readonly SaleClientChoice[],
  selectedId: string,
  limit = SALE_CLIENT_CHIP_LIMIT
): SaleClientChoice[] {
  const shown = ranked.slice(0, limit)
  if (!selectedId || shown.some((choice) => choice.id === selectedId)) {
    return shown
  }

  const selected = ranked.find((choice) => choice.id === selectedId)
  return selected ? [...shown, selected] : shown
}

/** 삭제되지 않은 매출 행들의 client_id를 거래처별 건수로 센다 (null은 건너뜀). */
export function countSalesByClient(
  rows: readonly { client_id: string | null }[]
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!row.client_id) continue
    counts.set(row.client_id, (counts.get(row.client_id) ?? 0) + 1)
  }
  return counts
}

/**
 * 거래처를 새로 고르거나 해제할 때 계산서정보(billing_entity_name)를 어떻게 할지 정한다.
 * 계산서정보가 비어 있거나 이전에 고른 거래처 이름 그대로면 자동으로 채운 값이라고 보고 새 이름으로
 * 바꾼다(해제하면 비운다). 직접 다르게 적은 값은 건드리지 않는다.
 *
 * @returns 새 계산서정보 값. 바꾸지 말아야 하면 null.
 */
export function nextBillingEntityName(input: {
  currentBilling: string
  previousClientName: string
  nextClientName: string | null
}): string | null {
  const billing = input.currentBilling.trim()
  const previous = input.previousClientName.trim()
  const isAutoFilled = billing === "" || billing === previous

  if (!isAutoFilled) return null
  return input.nextClientName?.trim() ?? ""
}
