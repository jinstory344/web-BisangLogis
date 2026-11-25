import type { Metadata } from "next"

import { FormPageHeader } from "@/components/form/form-page-header"
import { carLedgerHref, firstParam } from "@/lib/car-ledger/url"
import { getTodayInSeoul } from "@/lib/date"
import { safeReturnPath } from "@/lib/return-to"
import { createClient } from "@/lib/supabase/server"
import { carLogFormDefaults } from "@/lib/validations/car-log"

import { createCarLogAction } from "../actions"
import { CarLogForm } from "../car-log-form"
import { loadCarMasters } from "../data"

export const metadata: Metadata = {
  title: "차계부 기록 등록 · 비상로지스",
}

/** 차계부 기록 등록 (`?car=<id>&kind=<종류>&returnTo=…`) — 승용차 등 차계부에만 저장하는 기록 */
export default async function NewCarLogPage({
  searchParams,
}: {
  searchParams: Promise<{ car?: string | string[]; kind?: string | string[]; returnTo?: string | string[] }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const masters = await loadCarMasters(supabase)
  const car = masters.cars.find((row) => row.id === firstParam(params.car)) ?? masters.cars.find((row) => row.kind === "personal") ?? masters.cars[0]
  const backHref = safeReturnPath(firstParam(params.returnTo)) ?? carLedgerHref({ car: car?.id })
  const kinds = masters.logKinds.map((row) => row.name)
  const requestedKind = firstParam(params.kind)
  const kind = kinds.includes(requestedKind) ? requestedKind : (kinds[0] ?? "")

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        <FormPageHeader title={car ? `${car.name} 기록` : "차계부 기록"} backHref={backHref} backLabel="차계부" />
        {car ? (
          <CarLogForm
            action={createCarLogAction.bind(null, backHref)}
            defaultValues={carLogFormDefaults(car.id, kind, getTodayInSeoul())}
            submitLabel="등록"
            kinds={kinds}
            serviceItemNames={masters.serviceItems.map((row) => row.name)}
            returnTo={backHref}
          />
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {masters.error ? `차 목록을 불러오지 못했어요: ${masters.error}` : "먼저 차계부 설정에서 차를 추가하세요."}
          </p>
        )}
      </div>
    </div>
  )
}
