import type { Metadata } from "next"

import { FormPageHeader } from "@/components/form/form-page-header"
import { createClient } from "@/lib/supabase/server"

import { loadCarMasters, loadServiceHistory } from "../data"
import { HistoryTab } from "../history-tab"

export const metadata: Metadata = {
  title: "차계부 이전 정비 기록 · 비상로지스",
}

/** 11월 이전 정비 기록(엑셀에서 옮긴 보기 전용 목록) — 차계부 설정 안 메뉴에서 들어온다 */
export default async function CarServiceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ car?: string }>
}) {
  const { car: requested } = await searchParams
  const supabase = await createClient()
  const { cars } = await loadCarMasters(supabase)
  const car = cars.find((row) => row.id === requested) ?? cars.find((row) => row.kind === "business") ?? cars[0]
  const rows = car ? await loadServiceHistory(supabase, car.id) : []

  return (
    <div className="px-4 pt-6 pb-8 md:p-6">
      <div className="mx-auto flex max-w-lg flex-col gap-4">
        <FormPageHeader title="차계부 이전 정비 기록" backHref="/car-ledger/settings" backLabel="차계부 설정" />
        <HistoryTab rows={rows} />
      </div>
    </div>
  )
}
