import { describe, expect, it } from "vitest"

import { expensesToSheet, salesToSheet } from "@/lib/backup-sheet"
import type { ExpenseRow, SaleRow } from "@/lib/supabase/database.types"

const base = { id: "1", created_at: "", updated_at: null, deleted_at: null }

describe("salesToSheet", () => {
  it("제목 줄 다음에 매출을 한 줄씩 넣고, 줄마다 칸 수가 같다", () => {
    const sale: SaleRow = {
      ...base,
      sale_date: "2026-11-01",
      origin: "피셔",
      destination: "-부산",
      supply_amount: 100000,
      vat_amount: 10000,
      total_amount: 110000,
      is_vat_exempt: false,
      payment_method: "TAX_INVOICE",
      payment_status: "PAID",
      paid_at: "2026-11-02T00:00:00+00:00",
      source_major: "카카오톡",
      source_sub: "스마일",
      source_minor: "김재천",
      source_note: null,
      billing_entity_name: "=SUM(A1)",
      order_contact_phone: "+821012345678",
      client_id: null,
      memo: null,
    }
    const [header, row] = salesToSheet([sale])
    expect(row).toHaveLength(header.length)
    expect(row.slice(0, 12)).toEqual([
      "2026-11-01",
      "카카오톡",
      "스마일",
      "김재천",
      "피셔",
      "'-부산",
      100000,
      10000,
      110000,
      "세금계산서",
      "입금 완료",
      "2026-11-02",
    ])
    // 수식처럼 보이는 글자는 실행되지 않게 막는다
    expect(row[12]).toBe("'=SUM(A1)")
    expect(row[13]).toBe("'+821012345678")
  })

  it("미입금은 입금일이 빈칸", () => {
    const sale = {
      ...base,
      payment_method: "TRANSFER",
      payment_status: "UNPAID",
      paid_at: null,
    } as SaleRow
    const row = salesToSheet([sale])[1]
    expect(row[10]).toBe("미입금")
    expect(row[11]).toBe("")
  })
})

describe("expensesToSheet", () => {
  it("지출을 한 줄씩 넣는다", () => {
    const expense: ExpenseRow = {
      ...base,
      expense_date: "2026-11-03",
      category_major: "차량",
      category_minor: "주유비",
      amount: 80000,
      payment_method: null,
      installment_months: null,
      vendor: null,
      has_tax_invoice: true,
      memo: "메모",
    }
    const [header, row] = expensesToSheet([expense])
    expect(row).toHaveLength(header.length)
    expect(row).toEqual([
      "2026-11-03",
      "차량",
      "주유비",
      80000,
      "",
      "",
      "",
      "있음",
      "메모",
    ])
  })
})
