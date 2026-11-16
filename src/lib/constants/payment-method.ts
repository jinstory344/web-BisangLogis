import { installmentLabel } from "@/lib/installment"
import type {
  ExpensePaymentMethod,
  PaymentMethod,
} from "@/lib/supabase/database.types"

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  TAX_INVOICE: "세금계산서",
  TRANSFER: "계좌이체",
  CASH: "현금",
}

export const PAYMENT_METHOD_OPTIONS = (
  Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]
).map(([value, label]) => ({ value, label }))

export const EXPENSE_PAYMENT_METHOD_LABELS: Record<
  ExpensePaymentMethod,
  string
> = {
  CARD: "카드",
  TRANSFER: "계좌이체",
  CASH: "현금",
}

export const EXPENSE_PAYMENT_METHOD_OPTIONS = (
  Object.entries(EXPENSE_PAYMENT_METHOD_LABELS) as [
    ExpensePaymentMethod,
    string,
  ][]
).map(([value, label]) => ({ value, label }))

/**
 * 지출 결제 표시: "카드 · 신한복지 · 할부 3/6". 카드 이름·할부는 카드일 때만
 * (카드가 아닌데 값이 남아 있는 옛 데이터는 숨긴다).
 */
export function expensePaymentLabel(row: {
  payment_method: ExpensePaymentMethod | null
  card_name: string | null
  installment_no: number | null
  installment_months: number | null
}): string {
  if (!row.payment_method) return ""
  const isCard = row.payment_method === "CARD"
  return [
    EXPENSE_PAYMENT_METHOD_LABELS[row.payment_method],
    isCard ? row.card_name : null,
    isCard ? installmentLabel(row.installment_no, row.installment_months) : null,
  ]
    .filter(Boolean)
    .join(" · ")
}
