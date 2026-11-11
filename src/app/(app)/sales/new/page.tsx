import { CopyNotice } from "@/components/form/copy-notice"
import { getTodayInSeoul } from "@/lib/date"
import { parseCopyId } from "@/lib/quick-entry"
import { createClient } from "@/lib/supabase/server"
import {
  buildSaleCopyDefaults,
  saleFormDefaults,
  type SaleFormValues,
} from "@/lib/validations/sales"

import { createSaleAction, getRecentSaleRoutesAction } from "../actions"
import { getSaleClientChoices } from "../client-choices"
import { SalesForm } from "../sales-form"

/**
 * 이전 건 복사(?copy=id): 삭제되지 않은 매출을 읽어 폼의 모든 필드를 채우고 날짜만 오늘로.
 * 없는 id·삭제된 건·잘못된 형식이면 조용히 null(빈 폼).
 */
async function loadSaleCopyDefaults(id: string): Promise<SaleFormValues | null> {
  const supabase = await createClient()
  const { data: sale } = await supabase
    .from("sales")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  return sale ? buildSaleCopyDefaults(sale, getTodayInSeoul()) : null
}

export default async function NewSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string | string[] }>
}) {
  const { copy } = await searchParams
  const copyId = parseCopyId(copy)

  const [copiedValues, recentRoutes, clientChoices] = await Promise.all([
    copyId ? loadSaleCopyDefaults(copyId) : null,
    // 최근 구간 칩·거래처 명단은 부가 기능이라 조회 실패 시 그 부분만 비운다 (매출 폼은 계속 쓸 수 있다).
    getRecentSaleRoutesAction().catch(() => []),
    getSaleClientChoices().catch(() => []),
  ])

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">매출 등록</h1>
      {copiedValues ? <CopyNotice /> : null}
      <div className="mt-4 max-w-lg">
        {/* 같은 화면에서 다른 건을 복사하거나 빈 폼으로 돌아올 때 폼 상태를 새로 만든다. */}
        <SalesForm
          key={copiedValues ? copyId : "new"}
          action={createSaleAction}
          defaultValues={copiedValues ?? saleFormDefaults}
          recentRoutes={recentRoutes}
          clientChoices={clientChoices}
          submitLabel="등록"
        />
      </div>
    </div>
  )
}
