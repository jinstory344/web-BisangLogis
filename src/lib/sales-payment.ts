import type { SaleRow } from "@/lib/supabase/database.types"

type PaymentPatch = Pick<SaleRow, "payment_status" | "paid_at">

/** 입금 처리: 입금완료로 바꾸고 입금일을 기록한다. */
export function markPaidPatch(paidAt: string): PaymentPatch {
  return { payment_status: "PAID", paid_at: paidAt }
}

/**
 * 입금 취소: 미입금으로 되돌리고 입금일을 지운다.
 * 미입금인데 입금일이 남아 있으면 상세·목록에 "미입금인데 입금일이 있는" 모순이 생기므로 입금일은 반드시 비운다.
 */
export function cancelPaidPatch(): PaymentPatch {
  return { payment_status: "UNPAID", paid_at: null }
}
