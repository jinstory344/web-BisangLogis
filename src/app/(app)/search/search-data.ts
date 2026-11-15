import { appendClientIdFilter, buildIlikeOrFilter } from "@/lib/search"
import type { DispatchRow } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

import { fetchAllRows } from "../ledger-data"

type Supabase = Awaited<ReturnType<typeof createClient>>

/** 이름에 검색어가 들어간 거래처 id (매출·배차를 거래처 이름으로도 찾기 위해) */
export async function searchClientIds(
  supabase: Supabase,
  query: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .is("deleted_at", null)
    .ilike("name", `%${query}%`)
    .limit(50)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.id)
}

/** 배차는 달별로 접어 보여 주므로 매출·지출보다 많이 가져온다 (차량번호로 몇 년 치를 보는 경우) */
export const DISPATCH_SEARCH_LIMIT = 300

/** 누르면 뜨는 작업 시트(담당자·차량·화물·비고 등)에 행 전체가 필요하다 */
export type SearchDispatch = DispatchRow

/**
 * 통합검색: 배차를 글자와 기간으로 찾는다 (최근 날짜부터 최대 DISPATCH_SEARCH_LIMIT건, query가 비면 기간만).
 * 상차지·하차지·차량번호·기사·담당자·배차자·비고, 그리고 이름이 맞는 거래처의 배차.
 * 화면에 보여 줄 거래처 이름도 함께 돌려준다.
 */
export async function searchDispatches(
  supabase: Supabase,
  query: string,
  clientIds: readonly string[],
  period: { from: string; to: string } | null = null
): Promise<{
  dispatches: SearchDispatch[]
  clientNameMap: Record<string, string>
  isTruncated: boolean
}> {
  let request = supabase.from("dispatches").select("*").is("deleted_at", null)
  if (query) {
    request = request.or(
      appendClientIdFilter(
        buildIlikeOrFilter(
          ["origin", "destination", "plate_no_snapshot", "driver_name_snapshot", "contact_name", "dispatcher_name", "memo"],
          query
        ),
        clientIds
      )
    )
  }
  if (period) request = request.gte("dispatch_date", period.from).lte("dispatch_date", period.to)
  const { data, error } = await request
    .order("dispatch_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(DISPATCH_SEARCH_LIMIT)
  if (error) throw new Error(error.message)
  const dispatches = data ?? []

  const ids = [
    ...new Set(dispatches.map((row) => row.client_id).filter((id): id is string => !!id)),
  ]
  const clientNameMap: Record<string, string> = {}
  if (ids.length > 0) {
    const clients = await supabase.from("clients").select("id, name").in("id", ids)
    if (clients.error) throw new Error(clients.error.message)
    for (const client of clients.data ?? []) clientNameMap[client.id] = client.name
  }

  return {
    dispatches,
    clientNameMap,
    isTruncated: dispatches.length >= DISPATCH_SEARCH_LIMIT,
  }
}

/** 통합검색 배차 합계·건수 (목록이 잘려도 조건에 맞는 전부로 센다) */
export async function searchDispatchTotals(
  supabase: Supabase,
  query: string,
  clientIds: readonly string[],
  period: { from: string; to: string } | null
): Promise<{ count: number; freight: number; fee: number }> {
  const rows = await fetchAllRows((a, b) => {
    let request = supabase.from("dispatches").select("freight_amount, fee_amount").is("deleted_at", null)
    if (query) {
      request = request.or(
        appendClientIdFilter(
          buildIlikeOrFilter(
            ["origin", "destination", "plate_no_snapshot", "driver_name_snapshot", "contact_name", "dispatcher_name", "memo"],
            query
          ),
          clientIds
        )
      )
    }
    if (period) request = request.gte("dispatch_date", period.from).lte("dispatch_date", period.to)
    return request.order("id").range(a, b)
  })
  return {
    count: rows.length,
    freight: rows.reduce((sum, r) => sum + (r.freight_amount ?? 0), 0),
    fee: rows.reduce((sum, r) => sum + r.fee_amount, 0),
  }
}
