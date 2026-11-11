import { describe, expect, it } from "vitest"

import { cancelPaidPatch, markPaidPatch } from "./sales-payment"

describe("입금 처리 / 입금 취소 변경값", () => {
  it("입금 처리는 입금완료와 입금일을 기록한다", () => {
    expect(markPaidPatch("2026-11-11")).toEqual({
      payment_status: "PAID",
      paid_at: "2026-11-11",
    })
  })

  it("입금 취소는 미입금으로 되돌리고 입금일을 지운다 (null)", () => {
    expect(cancelPaidPatch()).toEqual({ payment_status: "UNPAID", paid_at: null })
  })

  it("입금 처리 후 입금 취소하면 처음 상태(미입금·입금일 없음)와 같다", () => {
    const original = { payment_status: "UNPAID", paid_at: null }
    const paid = { ...original, ...markPaidPatch("2026-11-11") }
    expect({ ...paid, ...cancelPaidPatch() }).toEqual(original)
  })
})
