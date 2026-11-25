import { formatBizNo } from "@/lib/biz-no"
import { CARGO_BOX_TYPE_LABELS } from "@/lib/constants/cargo-box-type"
import { CLIENT_CATEGORY_LABELS } from "@/lib/constants/client"
import { DROPOFF_TYPE_LABELS } from "@/lib/constants/dropoff-type"
import { EXPENSE_PAYMENT_METHOD_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants/payment-method"
import type { ClientRow, DispatchRow, ExpenseRow, SaleRow, VehicleRow } from "@/lib/supabase/database.types"

/** 엑셀 내보내기 종류 (시트 하나씩) */
export type ExportKind = "sale" | "expense" | "dispatch" | "client" | "vehicle" | "car_log"

export const EXPORT_KINDS: { value: ExportKind; label: string; unit: string }[] = [
  { value: "sale", label: "매출", unit: "건" },
  { value: "expense", label: "지출", unit: "건" },
  { value: "dispatch", label: "배차", unit: "건" },
  { value: "client", label: "거래처", unit: "곳" },
  { value: "vehicle", label: "차량", unit: "대" },
  { value: "car_log", label: "차계부", unit: "건" },
]

/** 날짜·기간이 있는 종류 (거래처·차량은 기간과 상관없이 전부) */
export const DATED_KINDS: readonly ExportKind[] = ["sale", "expense", "dispatch", "car_log"]

export type Cell = string | number
export type Table = Cell[][]

const s = (v: string | null | undefined) => v ?? ""
const n = (v: number | null | undefined) => (v == null ? "" : v)

/** 매출 시트 — 가져오기 양식과 같은 칸 이름 */
export const SALE_COLUMNS = [
  "매출일", "상차지", "하차지", "출처", "출처 하위분류", "오더자·거래처", "담당자", "연락처",
  "공급가액", "세액", "합계", "지불방법", "입금", "입금일", "사업자 정보", "물량", "중량(톤)", "출처 비고", "비고",
]
export function salesTable(rows: SaleRow[]): Table {
  return [
    SALE_COLUMNS,
    ...rows.map((r) => [
      r.sale_date, r.origin, r.destination, s(r.source_major), s(r.source_sub), s(r.source_minor),
      s(r.contact_name), s(r.order_contact_phone), r.supply_amount, r.vat_amount, r.total_amount,
      PAYMENT_METHOD_LABELS[r.payment_method] ?? r.payment_method,
      r.payment_status === "PAID" ? "입금 완료" : "미입금", r.paid_at ? r.paid_at.slice(0, 10) : "",
      s(r.billing_entity_name), s(r.cargo_note), n(r.weight_ton), s(r.source_note), s(r.memo),
    ]),
  ]
}

export const EXPENSE_COLUMNS = [
  "지출일", "대분류", "소분류", "사용처", "금액", "결제방법", "카드", "할부(개월)", "회차", "리터", "비고",
]
export function expensesTable(rows: ExpenseRow[]): Table {
  return [
    EXPENSE_COLUMNS,
    ...rows.map((r) => [
      r.expense_date, r.category_major, r.category_minor, s(r.vendor), r.amount,
      r.payment_method ? EXPENSE_PAYMENT_METHOD_LABELS[r.payment_method] : "", s(r.card_name),
      n(r.installment_months), n(r.installment_no), n(r.liters), s(r.memo),
    ]),
  ]
}

export const DISPATCH_COLUMNS = [
  "운송일", "거래처", "담당자", "담당자 연락처", "상차지", "하차지", "하차일", "차량번호", "차주", "차주 연락처",
  "차종", "파렛", "물량", "중량(톤)", "운임", "수수료", "비고",
]
export function dispatchesTable(rows: DispatchRow[], clientNames: ReadonlyMap<string, string>): Table {
  return [
    DISPATCH_COLUMNS,
    ...rows.map((r) => [
      r.dispatch_date, r.client_id ? (clientNames.get(r.client_id) ?? "") : "", s(r.contact_name), s(r.contact_phone),
      r.origin, r.destination, DROPOFF_TYPE_LABELS[r.dropoff_type] ?? r.dropoff_type,
      s(r.plate_no_snapshot), s(r.driver_name_snapshot), s(r.driver_phone_snapshot),
      r.cargo_box_type ? CARGO_BOX_TYPE_LABELS[r.cargo_box_type] : "", n(r.pallet_count), s(r.cargo_note),
      n(r.weight_ton), n(r.freight_amount), r.fee_amount, s(r.memo),
    ]),
  ]
}

export function clientsTable(
  rows: ClientRow[],
  contacts: ReadonlyMap<string, { name: string; phone: string | null }[]>
): Table {
  return [
    ["거래처명", "분류", "사업자번호", "대표자", "주소", "업태", "종목", "이메일", "담당자", "비고"],
    ...rows.map((r) => {
      const people = contacts.get(r.id) ?? (r.contact_name ? [{ name: r.contact_name, phone: r.contact_phone }] : [])
      return [
        r.name, CLIENT_CATEGORY_LABELS[r.category] ?? r.category, r.biz_no ? formatBizNo(r.biz_no) : "", s(r.ceo_name), s(r.address),
        s(r.biz_type), s(r.biz_item), s(r.contact_email),
        people.map((p) => [p.name, p.phone].filter(Boolean).join(" ")).join(", "), s(r.memo),
      ]
    }),
  ]
}

export function vehiclesTable(rows: VehicleRow[]): Table {
  return [
    ["차량번호", "차주", "연락처", "차종", "파렛수", "메모"],
    ...rows.map((r) => [r.plate_no, r.driver_name, s(r.driver_phone), s(r.vehicle_type), n(r.pallet_count), s(r.memo)]),
  ]
}

/** 차계부 한 줄 (지출 기반 트럭 기록 + 차계부에만 넣은 기록, 할부는 회차 줄마다) */
export interface CarExportRow {
  car: string
  date: string
  kind: string
  items: string
  amount: number
  liters: number | null
  km: number | null
  vendor: string | null
  payment: string
  memo: string | null
}

export function carLedgerTable(rows: CarExportRow[]): Table {
  return [
    ["차", "날짜", "종류", "정비 항목", "금액", "리터", "주행거리(km)", "정비소·장소", "결제", "비고"],
    ...rows.map((r) => [r.car, r.date, r.kind, r.items, r.amount, n(r.liters), n(r.km), s(r.vendor), r.payment, s(r.memo)]),
  ]
}

/** 차계부 이전 정비 기록(엑셀에서 옮긴 것) */
export function carHistoryTable(
  rows: { car: string; service_date: string; odometer_km: number | null; content: string; amount: number | null; vendor: string | null }[]
): Table {
  return [
    ["차", "날짜", "주행거리(km)", "정비 내역", "금액", "정비소"],
    ...rows.map((r) => [r.car, r.service_date, n(r.odometer_km), r.content.replace(/\n/g, " / "), n(r.amount), s(r.vendor)]),
  ]
}

/** 파일 이름: 비상로지스_2026-11.xlsx / 비상로지스_2026.xlsx / 비상로지스_전체.xlsx / 비상로지스_2026-11-01_2026-11-20.xlsx */
export function exportFileName(from: string | null, to: string | null): string {
  if (!from || !to) return "비상로지스_전체.xlsx"
  const lastDay = new Date(Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)), 0)).getUTCDate()
  const isWholeMonth = from.slice(0, 7) === to.slice(0, 7) && from.endsWith("-01") && Number(to.slice(8, 10)) === lastDay
  const isWholeYear = from.slice(0, 4) === to.slice(0, 4) && from.endsWith("-01-01") && to.endsWith("-12-31")
  const label = isWholeYear ? from.slice(0, 4) : isWholeMonth ? from.slice(0, 7) : `${from}_${to}`
  return `비상로지스_${label}.xlsx`
}
