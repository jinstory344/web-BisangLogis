import type { Metadata } from "next"

import { EXPENSE_PAYMENT_METHOD_LABELS } from "@/lib/constants/payment-method"
import { formatKRW } from "@/lib/money"
import { createClient } from "@/lib/supabase/server"
import type { TrashItem } from "@/lib/trash"
import { vehicleSpecLabel } from "@/lib/validations/vehicle"

import { TrashList } from "./trash-list"

export const metadata: Metadata = {
  title: "휴지통 · 비상로지스",
}

/** "2026-11-19" → "11/19" */
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
const join = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ")

/**
 * 휴지통: 지운 매출·지출·배차·거래처·차량·메모·차계부 기록. 줄을 밀어 복구·완전 삭제, [모두 선택]으로 여러 건.
 * 지운 지 30일이 지나면 DB가 매일 새벽 저절로 완전 삭제한다(purge_expired_trash).
 */
export default async function TrashPage() {
  const supabase = await createClient()
  const [sales, expenses, dispatches, clients, vehicles, memos, carLogs, refs] = await Promise.all([
    supabase
      .from("sales")
      .select("id, deleted_at, sale_date, origin, destination, source_minor, total_amount")
      .not("deleted_at", "is", null),
    supabase
      .from("expenses")
      .select("id, deleted_at, expense_date, category_major, category_minor, payment_method, card_name, amount")
      .not("deleted_at", "is", null),
    supabase
      .from("dispatches")
      .select("id, deleted_at, dispatch_date, origin, destination, driver_name_snapshot, plate_no_snapshot, freight_amount")
      .not("deleted_at", "is", null),
    supabase.from("clients").select("id, deleted_at, name, contact_name").not("deleted_at", "is", null),
    supabase
      .from("vehicles")
      .select("id, deleted_at, driver_name, plate_no, vehicle_type, pallet_count")
      .not("deleted_at", "is", null),
    supabase.from("memos").select("id, deleted_at, title, kind").not("deleted_at", "is", null),
    // 차계부 기록(승용차 등). 표를 못 읽으면 빈 목록
    supabase
      .from("car_logs")
      .select("id, deleted_at, log_date, kind, amount, vendor, car_id")
      .not("deleted_at", "is", null),
    // 지운 거래처 중 아직 기록(배차·매출·메모)이 가리키는 곳 — 완전 삭제를 막고 보관한다
    Promise.all([
      supabase.from("dispatches").select("client_id").not("client_id", "is", null),
      supabase.from("sales").select("client_id").not("client_id", "is", null),
      supabase.from("memos").select("client_id").not("client_id", "is", null),
    ]),
  ])

  const usedClientIds = new Set(
    refs.flatMap((r) => (r.data ?? []).map((row) => row.client_id as string))
  )
  const MEMO_KIND: Record<string, string> = { DISPATCH: "배차메모", WORK: "업무메모", ORDER: "오더메모" }
  const carIds = [...new Set((carLogs.data ?? []).map((r) => r.car_id))]
  const { data: cars } = carIds.length
    ? await supabase.from("cars").select("id, name").in("id", carIds)
    : { data: [] as { id: string; name: string }[] }
  const carName = new Map((cars ?? []).map((car) => [car.id, car.name]))

  const items: TrashItem[] = [
    ...(sales.data ?? []).map((r) => ({
      kind: "sale" as const,
      id: r.id,
      deletedAt: r.deleted_at as string,
      title: `${r.origin} → ${r.destination}`,
      sub: join(md(r.sale_date), r.source_minor, formatKRW(r.total_amount)),
    })),
    ...(expenses.data ?? []).map((r) => ({
      kind: "expense" as const,
      id: r.id,
      deletedAt: r.deleted_at as string,
      title: r.category_minor || r.category_major,
      sub: join(md(r.expense_date), r.payment_method && EXPENSE_PAYMENT_METHOD_LABELS[r.payment_method], r.card_name, formatKRW(r.amount)),
    })),
    ...(dispatches.data ?? []).map((r) => ({
      kind: "dispatch" as const,
      id: r.id,
      deletedAt: r.deleted_at as string,
      title: `${r.origin} → ${r.destination}`,
      sub: join(
        md(r.dispatch_date),
        r.driver_name_snapshot || r.plate_no_snapshot,
        r.freight_amount != null && formatKRW(r.freight_amount)
      ),
    })),
    ...(clients.data ?? []).map((r) => ({
      kind: "client" as const,
      id: r.id,
      deletedAt: r.deleted_at as string,
      title: r.name,
      sub: join(r.contact_name && `담당 ${r.contact_name}`),
      kept: usedClientIds.has(r.id),
    })),
    ...(vehicles.data ?? []).map((r) => ({
      kind: "vehicle" as const,
      id: r.id,
      deletedAt: r.deleted_at as string,
      title: `${r.driver_name} · ${r.plate_no}`,
      sub: vehicleSpecLabel(r),
    })),
    ...(memos.data ?? []).map((r) => ({
      kind: "memo" as const,
      id: r.id,
      deletedAt: r.deleted_at as string,
      title: r.title,
      sub: MEMO_KIND[r.kind] ?? "메모",
    })),
    ...(carLogs.data ?? []).map((r) => ({
      kind: "car_log" as const,
      id: r.id,
      deletedAt: r.deleted_at as string,
      title: `${carName.get(r.car_id) ?? "차"} · ${r.kind}`,
      sub: join(md(r.log_date), r.vendor, formatKRW(Number(r.amount))),
    })),
  ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <TrashList items={items} />
    </div>
  )
}
