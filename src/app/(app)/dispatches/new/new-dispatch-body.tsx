import type { ClientSearchResult } from "@/app/(app)/clients/actions"
import { CopyNotice } from "@/components/form/copy-notice"
import { getTodayInSeoul } from "@/lib/date"
import { createClient } from "@/lib/supabase/server"
import {
  buildDispatchCopyDefaults,
  dispatchFormDefaults,
  type DispatchFormValues,
} from "@/lib/validations/dispatch"

import { createDispatchAction, getRecentDispatchRoutesAction } from "../actions"
import { DispatchForm } from "../dispatch-form"

interface DispatchCopy {
  defaultValues: DispatchFormValues
  defaultClient: ClientSearchResult | null
}

/**
 * 이전 건 복사(?copy=id): 삭제되지 않은 배차를 읽어 수정 화면과 같은 필드(거래처·차량 스냅샷·
 * 운임/수수료·차종·하차일·파렛/중량·담당자·비고)를 채우고 날짜만 오늘로.
 * 거래처가 삭제됐으면 거래처를 비우고, 등록 차량이 삭제됐으면 vehicle_id만 비운다(스냅샷 유지).
 * 없는 id·삭제된 건·잘못된 형식이면 조용히 null(빈 폼).
 */
async function loadDispatchCopy(id: string): Promise<DispatchCopy | null> {
  const supabase = await createClient()
  const { data: dispatch } = await supabase
    .from("dispatches")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!dispatch) return null

  const [clientResult, vehicleResult] = await Promise.all([
    dispatch.client_id
      ? supabase
          .from("clients")
          .select("id, name, biz_no")
          .eq("id", dispatch.client_id)
          .is("deleted_at", null)
          .maybeSingle()
      : null,
    dispatch.vehicle_id
      ? supabase
          .from("vehicles")
          .select("id")
          .eq("id", dispatch.vehicle_id)
          .is("deleted_at", null)
          .maybeSingle()
      : null,
  ])

  const client = clientResult?.data ?? null

  return {
    defaultValues: buildDispatchCopyDefaults(dispatch, {
      today: getTodayInSeoul(),
      clientName: client?.name ?? null,
      isVehicleActive: Boolean(vehicleResult?.data),
    }),
    defaultClient: client,
  }
}

/**
 * 배차 등록 본문(복사 안내 + 폼). 단독 페이지와 통합 등록 화면(/new)이 함께 쓴다.
 * copyId가 있으면 그 건을 복사해 채운다(없는 건·삭제된 건이면 빈 폼).
 */
export async function NewDispatchBody({ copyId }: { copyId: string | null }) {

  const [copied, recentRoutes] = await Promise.all([
    copyId ? loadDispatchCopy(copyId) : null,
    // 최근 구간 칩은 부가 기능이라 조회 실패 시 칩만 숨긴다.
    getRecentDispatchRoutesAction().catch(() => []),
  ])

  return (
    <>
      {copied ? <CopyNotice /> : null}
      <div className="mt-4 max-w-lg">
        {/* 같은 화면에서 다른 건을 복사하거나 빈 폼으로 돌아올 때 폼 상태를 새로 만든다. */}
        <DispatchForm
          key={copied ? copyId : "new"}
          action={createDispatchAction}
          defaultValues={copied?.defaultValues ?? dispatchFormDefaults}
          defaultClient={copied?.defaultClient ?? null}
          recentRoutes={recentRoutes}
          submitLabel="등록"
        />
      </div>
    </>
  )
}
