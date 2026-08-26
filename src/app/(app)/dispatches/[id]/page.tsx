import { notFound } from "next/navigation"

import { CARGO_BOX_TYPE_LABELS } from "@/lib/constants/cargo-box-type"
import { DROPOFF_TYPE_LABELS } from "@/lib/constants/dropoff-type"
import { formatKRW } from "@/lib/money"
import { formatPhoneNumber } from "@/lib/phone"
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
        <DetailActions id={dispatch.id} />
      </div>

      <div className="mt-4 max-w-lg rounded-md border p-4">
        <Field label="운송일자" value={dispatch.dispatch_date} />
        <Field label="거래처" value={clientName} />
        <Field label="담당자" value={dispatch.contact_name ?? "-"} />
        <Field label="구간" value={`${dispatch.origin} → ${dispatch.destination}`} />
        <Field label="하차일" value={DROPOFF_TYPE_LABELS[dispatch.dropoff_type]} />
        <Field
          label="적재함 종류"
          value={
            dispatch.cargo_box_type
              ? CARGO_BOX_TYPE_LABELS[dispatch.cargo_box_type]
              : "-"
          }
        />
        <Field label="파렛 수량" value={String(dispatch.pallet_count ?? "-")} />
        <Field
          label="중량"
          value={dispatch.weight_ton != null ? `${dispatch.weight_ton}톤` : "-"}
        />
        <Field label="비고" value={dispatch.memo ?? "-"} />
        <Field
          label="차량정보"
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
        <Field label="연락처" value={formatPhoneNumber(dispatch.driver_phone_snapshot)} />
        <Field
          label="운임"
          value={
            dispatch.freight_amount != null
              ? formatKRW(dispatch.freight_amount)
              : "-"
          }
        />
        <Field label="수수료" value={formatKRW(dispatch.fee_amount)} />
      </div>
    </div>
  )
}
