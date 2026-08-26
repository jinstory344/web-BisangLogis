import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getCurrentMonthRangeInSeoul } from "@/lib/date"
import { createClient } from "@/lib/supabase/server"
import type { DispatchRow } from "@/lib/supabase/database.types"

import { DispatchFilters } from "./dispatch-filters"
import { DispatchList } from "./dispatch-list"

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

  // 하단 합계 행: 페이지가 아닌 필터 전체 기준 운임/수수료 합계.
  let summaryQuery = supabase
    .from("dispatches")
    .select("freight_amount, fee_amount")
    .is("deleted_at", null)
    .gte("dispatch_date", from)
    .lte("dispatch_date", to)

  if (clientId) summaryQuery = summaryQuery.eq("client_id", clientId)

  const [
    { data, error, count },
    { data: summaryRows },
  ] = await Promise.all([
    baseQuery.order("dispatch_date", { ascending: false }).range(rangeStart, rangeEnd),
    summaryQuery,
  ])

  const summary = (summaryRows ?? []).reduce(
    (acc, row) => ({
      freightAmount: acc.freightAmount + (row.freight_amount ?? 0),
      feeAmount: acc.feeAmount + row.fee_amount,
    }),
    { freightAmount: 0, feeAmount: 0 }
  )

  const clientIds = Array.from(
    new Set((data ?? []).map((d) => d.client_id).filter((v): v is string => !!v))
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

      <div className="mt-4">
        <DispatchFilters
          from={from}
          to={to}
          clientId={clientId}
          clientName={clientName}
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
