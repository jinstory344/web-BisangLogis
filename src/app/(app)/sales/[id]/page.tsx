import Link from "next/link"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { PaymentBadge } from "@/components/dispatches/payment-badge"
import { PAYMENT_METHOD_LABELS } from "@/lib/constants/payment-method"
import { formatKRW } from "@/lib/money"
import { formatPhoneNumber } from "@/lib/phone"
import { createClient } from "@/lib/supabase/server"

import { SaleDetailActions } from "./detail-actions"

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: sale } = await supabase
    .from("sales")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single()

  if (!sale) {
    notFound()
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">매출 상세</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/sales">리스트</Link>
          </Button>
          <SaleDetailActions id={sale.id} paymentStatus={sale.payment_status} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <PaymentBadge status={sale.payment_status} />
        {sale.is_vat_exempt ? (
          <span className="text-sm text-muted-foreground">면세</span>
        ) : null}
      </div>

      <div className="mt-4 max-w-lg rounded-md border p-4">
        <Field label="매출일자" value={sale.sale_date} />
        <Field label="구간" value={`${sale.origin} → ${sale.destination}`} />
        <Field label="공급가액" value={formatKRW(sale.supply_amount)} />
        <Field label="세액" value={formatKRW(sale.vat_amount)} />
        <Field label="합계금액" value={formatKRW(sale.total_amount)} />
        <Field
          label="지불방법"
          value={PAYMENT_METHOD_LABELS[sale.payment_method]}
        />
        <Field label="입금일" value={sale.paid_at ?? "-"} />
        <Field label="출처 대분류" value={sale.source_major ?? "-"} />
        <Field label="출처 소분류" value={sale.source_minor ?? "-"} />
        <Field label="출처 비고" value={sale.source_note ?? "-"} />
        <Field
          label="오더자 전화번호"
          value={formatPhoneNumber(sale.order_contact_phone)}
        />
        <Field
          label="계산서정보"
          value={sale.billing_entity_name ?? "-"}
        />
        <Field label="비고" value={sale.memo ?? "-"} />
      </div>
    </div>
  )
}
