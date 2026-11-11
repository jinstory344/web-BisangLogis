import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getCurrentMonthRangeInSeoul } from "@/lib/date"
import { createClient } from "@/lib/supabase/server"
import type { DispatchRow } from "@/lib/supabase/database.types"

import {
  DISPATCH_CLIENT_CHIP_LIMIT,
  filterDispatchesByClient,
  summarizeDispatches,
} from "@/lib/dispatch-list"

import { DispatchFilters } from "./dispatch-filters"
import { DispatchList } from "./dispatch-list"
import { DispatchMobileControls } from "./dispatch-mobile-controls"

const PAGE_SIZE = 50

interface DispatchSearchParams {
  from?: string
  to?: string
  client_id?: string
  client_name?: string
  page?: string
}

export default async function DispatchesPage({
  searchParams,
}: {
  searchParams: Promise<DispatchSearchParams>
}) {
  const params = await searchParams
  const defaultRange = getCurrentMonthRangeInSeoul()
  const from = params.from || defaultRange.from
  const to = params.to || defaultRange.to
  const clientId = params.client_id ?? ""
  const clientName = params.client_name ?? ""
  const page = Math.max(1, Number(params.page) || 1)

  const supabase = await createClient()

  let baseQuery = supabase
    .from("dispatches")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .gte("dispatch_date", from)
    .lte("dispatch_date", to)

  if (clientId) baseQuery = baseQuery.eq("client_id", clientId)

  const rangeStart = (page - 1) * PAGE_SIZE
  const rangeEnd = rangeStart + PAGE_SIZE - 1

  // 합계: 페이지가 아닌 전체 기준. 거래처 필터는 빼고 기간 안의 배차를 한 번에 가져와서
  // 모바일 상단의 전체 요약과 거래처 칩을 만들고, 목록 합계는 그중 선택한 거래처 몫이다.
  const summaryQuery = supabase
    .from("dispatches")
    .select("client_id, freight_amount, fee_amount")
    .is("deleted_at", null)
    .gte("dispatch_date", from)
    .lte("dispatch_date", to)

  const [
    { data, error, count },
    { data: summaryRows },
  ] = await Promise.all([
    baseQuery
      .order("dispatch_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(rangeStart, rangeEnd),
    summaryQuery,
  ])

  const rangeSummary = summarizeDispatches(summaryRows ?? [])
  const summary = summarizeDispatches(
    filterDispatchesByClient(summaryRows ?? [], clientId)
  )

  // 목록 행과 거래처 칩에 쓸 거래처 이름
  const clientIds = Array.from(
    new Set([
      ...(data ?? []).map((d) => d.client_id).filter((v): v is string => !!v),
      ...rangeSummary.byClient
        .slice(0, DISPATCH_CLIENT_CHIP_LIMIT)
        .map((c) => c.clientId),
      ...(clientId ? [clientId] : []),
    ])
  )
  let clientNameMap: Record<string, string> = {}
  if (clientIds.length > 0) {
    const { data: clientRows } = await supabase
      .from("clients")
      .select("id, name")
      .in("id", clientIds)
    clientNameMap = Object.fromEntries(
      (clientRows ?? []).map((c) => [c.id, c.name])
    )
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">배차 관리</h1>
        <Button asChild size="sm">
          <Link href="/dispatches/new">
            <Plus />
            배차 등록
          </Link>
        </Button>
      </div>

      <div className="mt-4 hidden md:block">
        <DispatchFilters
          from={from}
          to={to}
          clientId={clientId}
          clientName={clientName}
        />
      </div>
      <div className="mt-3 md:hidden">
        <DispatchMobileControls
          from={from}
          to={to}
          clientId={clientId}
          clientName={clientName}
          summary={rangeSummary}
          clientNames={clientNameMap}
        />
      </div>

      {error ? (
        <p className="mt-6 text-sm text-destructive">
          배차 목록을 불러오지 못했습니다: {error.message}
        </p>
      ) : (
        <div className="mt-4">
          <DispatchList
            dispatches={(data ?? []) as DispatchRow[]}
            clientNameMap={clientNameMap}
            totalCount={count ?? 0}
            summary={summary}
            page={page}
            totalPages={totalPages}
          />
        </div>
      )}
    </div>
  )
}
