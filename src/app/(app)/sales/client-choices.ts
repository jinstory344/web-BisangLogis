import { getTaxInfoStatus } from "@/lib/client-tax-info"
import { normalizeClientCategory } from "@/lib/constants/client"
import {
  countSalesByClient,
  rankSaleClientChoices,
  type SaleClientChoice,
} from "@/lib/sale-clients"
import { createClient } from "@/lib/supabase/server"

/** 거래처별 매출 사용 횟수를 세기 위해 읽어올 최근 매출 행 수 */
const SALE_USAGE_SCAN_SIZE = 2000

/**
 * 매출 폼 소분류(출처 = 거래처)에서 고를 거래처 목록: 삭제되지 않은 모든 거래처를
 * 매출에서 많이 쓴 순으로 정렬해 돌려준다. 세금계산서 정보는 입력 상태만 담는다.
 *
 * 거래처 목록 조회가 실패하면 던진다(호출 쪽이 빈 목록으로 대체 — 매출 폼은 계속 쓸 수 있어야 한다).
 * 사용 횟수 조회만 실패하면 정렬만 이름순으로 바뀐다.
 */
export async function getSaleClientChoices(): Promise<SaleClientChoice[]> {
  const supabase = await createClient()

  const [clientsResult, salesResult] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, category, biz_no, ceo_name, address, biz_type, biz_item")
      .is("deleted_at", null),
    supabase
      .from("sales")
      .select("client_id")
      .is("deleted_at", null)
      .not("client_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(SALE_USAGE_SCAN_SIZE),
  ])

  if (clientsResult.error) {
    throw new Error(`거래처 목록 조회 실패: ${clientsResult.error.message}`)
  }

  const usage = salesResult.error
    ? new Map<string, number>()
    : countSalesByClient(salesResult.data)

  const choices: SaleClientChoice[] = clientsResult.data.map((client) => ({
    id: client.id,
    name: client.name,
    category: normalizeClientCategory(client.category),
    taxStatus: getTaxInfoStatus(client),
  }))

  return rankSaleClientChoices(choices, usage)
}
