import {
  buildSaleSourceTree,
  DEFAULT_SALE_SOURCE_TREE,
  type SaleSourceTree,
} from "@/lib/constants/sale-sources"
import { createClient } from "@/lib/supabase/server"

export interface SaleSources {
  tree: SaleSourceTree
  /**
   * 출처를 직접 추가·삭제할 수 있는지. sale_sources 테이블을 읽었을 때만 true이고,
   * 읽지 못해 기본 목록으로 대신할 때는 false라서 화면에서 "편집"을 숨긴다.
   */
  editable: boolean
}

/**
 * 매출 출처 목록을 DB(sale_sources)에서 읽는다.
 * 테이블이 아직 없거나 읽기에 실패하거나 비어 있으면 기본 목록(하위분류 없음)으로 대신한다.
 */
export async function getSaleSources(): Promise<SaleSources> {
  const fallback: SaleSources = { tree: DEFAULT_SALE_SOURCE_TREE, editable: false }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("sale_sources")
      .select("major, sub, sort_order, created_at")
      .is("deleted_at", null)

    if (error || !data) return fallback

    const tree = buildSaleSourceTree(data)
    return tree.length > 0 ? { tree, editable: true } : fallback
  } catch {
    return fallback
  }
}
