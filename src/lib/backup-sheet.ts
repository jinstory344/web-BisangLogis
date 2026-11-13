import {
  EXPENSE_PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants/payment-method"
import type { ExpenseRow, SaleRow } from "@/lib/supabase/database.types"

/** 구글 시트 한 탭에 그대로 붙일 수 있는 표(첫 줄은 제목). */
export type SheetTable = (string | number)[][]

const SALE_HEADER = [
  "날짜",
  "출처",
  "하위분류",
  "오더자",
  "상차지",
  "하차지",
  "공급가액",
  "세액",
  "합계",
  "지불방법",
  "입금상태",
  "입금일",
  "사업자 정보",
  "오더자 전화",
  "출처 비고",
  "비고",
]

const EXPENSE_HEADER = [
  "날짜",
  "대분류",
  "소분류",
  "금액",
  "결제방법",
  "할부(개월)",
  "사용처",
  "계산서",
  "비고",
]

// 시트는 =, +, -, @ 로 시작하는 글자를 수식으로 실행하므로 앞에 '를 붙여 글자로 고정한다.
function text(value: string | null): string {
  if (!value) return ""
  return /^[=+\-@]/.test(value) ? `'${value}` : value
}

export function salesToSheet(rows: SaleRow[]): SheetTable {
  return [
    SALE_HEADER,
    ...rows.map((s) => [
      s.sale_date,
      text(s.source_major),
      text(s.source_sub),
      text(s.source_minor),
      text(s.origin),
      text(s.destination),
      s.supply_amount,
      s.vat_amount,
      s.total_amount,
      PAYMENT_METHOD_LABELS[s.payment_method] ?? s.payment_method,
      s.payment_status === "PAID" ? "입금 완료" : "미입금",
      s.paid_at ? s.paid_at.slice(0, 10) : "",
      text(s.billing_entity_name),
      text(s.order_contact_phone),
      text(s.source_note),
      text(s.memo),
    ]),
  ]
}

export function expensesToSheet(rows: ExpenseRow[]): SheetTable {
  return [
    EXPENSE_HEADER,
    ...rows.map((e) => [
      e.expense_date,
      text(e.category_major),
      text(e.category_minor),
      e.amount,
      e.payment_method
        ? (EXPENSE_PAYMENT_METHOD_LABELS[e.payment_method] ?? e.payment_method)
        : "",
      e.installment_months ?? "",
      text(e.vendor),
      e.has_tax_invoice ? "있음" : "",
      text(e.memo),
    ]),
  ]
}
