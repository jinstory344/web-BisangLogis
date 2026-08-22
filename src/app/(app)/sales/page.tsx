import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getCurrentMonthRangeInSeoul } from "@/lib/date"
import { createClient } from "@/lib/supabase/server"
import type { PaymentMethod, PaymentStatus, SaleRow } from "@/lib/supabase/database.types"

import { SalesFilters } from "./sales-filters"
import { SalesList } from "./sales-list"

const PAGE_SIZE = 50

interface SalesSearchParams {
  from?: string
  to?: string
  source_major?: string
  payment_status?: string
  payment_method?: string
  page?: string
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<SalesSearchParams>
}) {
  const params = await searchParams
  const defaultRange = getCurrentMonthRangeInSeoul()
  const from = params.from || defaultRange.from
  const to = params.to || defaultRange.to
  const sourceMajor = params.source_major ?? ""
  const paymentStatus = params.payment_status ?? ""
  const paymentMethod = params.payment_method ?? ""
  const page = Math.max(1, Number(params.page) || 1)

  const supabase = await createClient()

  let baseQuery = supabase
    .from("sales")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .gte("sale_date", from)
    .lte("sale_date", to)

  if (sourceMajor) baseQuery = baseQuery.eq("source_major", sourceMajor)
  if (paymentStatus) {
    baseQuery = baseQuery.eq("payment_status", paymentStatus as PaymentStatus)
  }
  if (paymentMethod) {
    baseQuery = baseQuery.eq("payment_method", paymentMethod as PaymentMethod)
  }

  const rangeStart = (page - 1) * PAGE_SIZE
  const rangeEnd = rangeStart + PAGE_SIZE - 1

  // 4.4 목록 하단 합계 행: 페이지가 아닌 필터 전체 기준 (건수/합계금액/공급가액)
  let summaryQuery = supabase
    .from("sales")
    .select("total_amount, supply_amount")
    .is("deleted_at", null)
    .gte("sale_date", from)
    .lte("sale_date", to)

  if (sourceMajor) summaryQuery = summaryQuery.eq("source_major", sourceMajor)
  if (paymentStatus) {
    summaryQuery = summaryQuery.eq(
      "payment_status",
      paymentStatus as PaymentStatus
    )
  }
  if (paymentMethod) {
    summaryQuery = summaryQuery.eq(
      "payment_method",
      paymentMethod as PaymentMethod
    )
  }

  // 서로 독립된 조회라 순차 대기 대신 동시에 보내 왕복 지연을 줄인다.
  const [
    { data, error, count },
    { data: summaryRows, error: summaryError },
  ] = await Promise.all([
    baseQuery.order("sale_date", { ascending: false }).range(rangeStart, rangeEnd),
    summaryQuery,
  ])

  const summary = (summaryRows ?? []).reduce(
    (acc, row) => ({
      count: acc.count + 1,
      totalAmount: acc.totalAmount + row.total_amount,
      supplyAmount: acc.supplyAmount + row.supply_amount,
    }),
    { count: 0, totalAmount: 0, supplyAmount: 0 }
  )

  // 개별 건 합계 === 표시된 합계 검산 (4.3.8). 조회 자체가 실패한 경우는
  // 아래 별도 에러 메시지로 안내하므로 검산 배너 대상이 아니다.
  const hasFetchError = !!error || !!summaryError
  const reconciliationMismatch =
    !hasFetchError && summary.count !== (count ?? 0)

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">매출 관리</h1>
        <Button asChild size="sm">
          <Link href="/sales/new">
            <Plus />
            매출 등록
          </Link>
        </Button>
      </div>

      {reconciliationMismatch ? (
        <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          검산 경고: 개별 건 합계와 표시된 합계가 일치하지 않습니다. 새로고침
          후에도 반복되면 관리자에게 문의하세요.
        </div>
      ) : null}

      <div className="mt-4">
        <SalesFilters
          from={from}
          to={to}
          sourceMajor={sourceMajor}
          paymentStatus={paymentStatus}
          paymentMethod={paymentMethod}
        />
      </div>

      {error ? (
        <p className="mt-6 text-sm text-destructive">
          매출 목록을 불러오지 못했습니다: {error.message}
        </p>
      ) : (
        <div className="mt-4">
          <SalesList
            sales={(data ?? []) as SaleRow[]}
            summary={summary}
            page={page}
            totalPages={totalPages}
          />
        </div>
      )}
    </div>
  )
}
