import { appendClientIdFilter, buildIlikeOrFilter } from "@/lib/search"
import type { DispatchRow } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

import { SEARCH_RESULT_LIMIT } from "../ledger-data"

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

export type SearchDispatch = Pick<
  DispatchRow,
  | "id"
  | "dispatch_date"
  | "client_id"
  | "origin"
  | "destination"
  | "plate_no_snapshot"
  | "driver_name_snapshot"
  | "freight_amount"
  | "fee_amount"
>

/**
 * 기간과 상관없이 배차를 글자로 찾는다 (최근 날짜부터 최대 SEARCH_RESULT_LIMIT건).
 * 상차지·하차지·차량번호·기사·담당자·배차자·비고, 그리고 이름이 맞는 거래처의 배차.
 * 화면에 보여 줄 거래처 이름도 함께 돌려준다.
 */
export async function searchDispatches(
  supabase: Supabase,
  query: string,
  clientIds: readonly string[]
): Promise<{
  dispatches: SearchDispatch[]
  clientNameMap: Record<string, string>
  isTruncated: boolean
}> {
  const { data, error } = await supabase
    .from("dispatches")
    .select(
      "id, dispatch_date, client_id, origin, destination, plate_no_snapshot, driver_name_snapshot, freight_amount, fee_amount"
    )
    .is("deleted_at", null)
    .or(
      appendClientIdFilter(
        buildIlikeOrFilter(
          [
            "origin",
            "destination",
            "plate_no_snapshot",
            "driver_name_snapshot",
            "contact_name",
            "dispatcher_name",
            "memo",
          ],
          query
        ),
        clientIds
      )
    )
    .order("dispatch_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(SEARCH_RESULT_LIMIT)
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
    isTruncated: dispatches.length >= SEARCH_RESULT_LIMIT,
  }
}
