import { notFound } from "next/navigation"

import { PaymentBadge } from "@/components/dispatches/payment-badge"
import { PAYMENT_METHOD_LABELS } from "@/lib/constants/payment-method"
import { formatKRW } from "@/lib/money"
import { createClient } from "@/lib/supabase/server"

import { DetailActions } from "./detail-actions"

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

export default async function DispatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: dispatch } = await supabase
    .from("dispatches")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single()

  if (!dispatch) {
    notFound()
  }

  let clientName = "-"
  if (dispatch.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", dispatch.client_id)
      .single()
    clientName = client?.name ?? "-"
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">배차 상세</h1>
        <DetailActions id={dispatch.id} paymentStatus={dispatch.payment_status} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <PaymentBadge status={dispatch.payment_status} />
        {dispatch.is_vat_exempt ? (
          <span className="text-sm text-muted-foreground">면세</span>
        ) : null}
      </div>

      <div className="mt-4 max-w-lg rounded-md border p-4">
        <Field label="운송일자" value={dispatch.dispatch_date} />
        <Field label="거래처" value={clientName} />
        <Field label="구간" value={`${dispatch.origin} → ${dispatch.destination}`} />
        <Field label="파렛 수량" value={String(dispatch.pallet_count ?? "-")} />
        <Field
          label="차량(기사)"
          value={
            dispatch.plate_no_snapshot
              ? `${dispatch.plate_no_snapshot}${
                  dispatch.driver_name_snapshot
                    ? ` (${dispatch.driver_name_snapshot})`
                    : ""
                }`
              : "-"
          }
        />
        <Field label="기사 연락처" value={dispatch.driver_phone_snapshot ?? "-"} />
        <Field label="운수사" value={dispatch.carrier_name ?? "-"} />
        <Field label="배차자" value={dispatch.dispatcher_name ?? "-"} />
        <Field label="합계운임" value={formatKRW(dispatch.total_amount)} />
        <Field label="공급가액" value={formatKRW(dispatch.supply_amount)} />
        <Field label="부가세" value={formatKRW(dispatch.vat_amount)} />
        <Field label="수수료" value={formatKRW(dispatch.fee_amount)} />
        <Field
          label="순수익(공급가액-수수료)"
          value={formatKRW(dispatch.supply_amount - dispatch.fee_amount)}
        />
        <Field
          label="지불방법"
          value={PAYMENT_METHOD_LABELS[dispatch.payment_method]}
        />
        <Field label="입금일" value={dispatch.paid_at ?? "-"} />
        <Field label="비고" value={dispatch.memo ?? "-"} />
      </div>
    </div>
  )
}
