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
