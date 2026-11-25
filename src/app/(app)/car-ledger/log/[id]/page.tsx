import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { FormPageHeader } from "@/components/form/form-page-header"
import { loadServiceItems } from "@/lib/car-ledger/service-items-db"
import { carLedgerHref, firstParam } from "@/lib/car-ledger/url"
import { safeReturnPath } from "@/lib/return-to"
import { createClient } from "@/lib/supabase/server"
import { carLogRowToFormValues } from "@/lib/validations/car-log"

import { updateCarLogAction } from "../../actions"
import { CarLogForm } from "../../car-log-form"
import { loadCarMasters } from "../../data"

export const metadata: Metadata = {
  title: "차계부 기록 수정 · 비상로지스",
}

/** 차계부 기록 수정·삭제 (삭제하면 휴지통으로) */
export default async function EditCarLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string | string[] }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: row }, masters, items] = await Promise.all([
    supabase.from("car_logs").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    loadCarMasters(supabase),
    loadServiceItems(supabase, { carLogId: id }),
  ])
  if (!row) notFound()

  const car = masters.cars.find((item) => item.id === row.car_id)
  const backHref =
    safeReturnPath(firstParam((await searchParams).returnTo)) ?? carLedgerHref({ car: row.car_id })

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        <FormPageHeader title={`${car?.name ?? "차계부"} 기록 수정`} backHref={backHref} backLabel="차계부" />
        <CarLogForm
          action={updateCarLogAction.bind(null, id, backHref)}
          defaultValues={carLogRowToFormValues(row, items)}
          submitLabel="저장"
          kinds={masters.logKinds.map((item) => item.name)}
          serviceItemNames={masters.serviceItems.map((item) => item.name)}
          deleteId={id}
          returnTo={backHref}
        />
      </div>
    </div>
  )
}
