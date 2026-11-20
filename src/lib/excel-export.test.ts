import { describe, expect, it } from "vitest"

import type { SaleRow, VehicleRow } from "@/lib/supabase/database.types"

import { SALE_COLUMNS, exportFileName, salesTable, vehiclesTable } from "./excel-export"

describe("엑셀 내보내기", () => {
  it("파일 이름: 한 달·한 해·전체·직접 기간", () => {
    expect(exportFileName("2026-11-01", "2026-11-30")).toBe("비상로지스_2026-11.xlsx")
    expect(exportFileName("2026-02-01", "2026-02-28")).toBe("비상로지스_2026-02.xlsx")
    expect(exportFileName("2026-01-01", "2026-12-31")).toBe("비상로지스_2026.xlsx")
    expect(exportFileName(null, null)).toBe("비상로지스_전체.xlsx")
    expect(exportFileName("2026-11-01", "2026-11-20")).toBe("비상로지스_2026-11-01_2026-11-20.xlsx")
  })

  it("매출 한 줄: 칸 수가 머리줄과 같고 금액은 숫자, 빈 칸은 빈 글자", () => {
    const sale = {
      sale_date: "2026-11-19", origin: "피셔", destination: "부산대", source_major: "거래처", source_sub: null,
      source_minor: "아토무역", contact_name: "이준호", order_contact_phone: "010-3581-0024",
      supply_amount: 400000, vat_amount: 40000, total_amount: 440000, payment_method: "TAX_INVOICE",
      payment_status: "UNPAID", paid_at: null, billing_entity_name: "아토무역", cargo_note: "냉동3p",
      weight_ton: 1, source_note: null, memo: null,
    } as unknown as SaleRow
    const [head, row] = salesTable([sale])
    expect(row).toHaveLength(head.length)
    expect(head).toEqual(SALE_COLUMNS)
    expect(row[8]).toBe(400000)
    expect(row[12]).toBe("미입금")
    expect(row[15]).toBe("냉동3p")
    expect(row[13]).toBe("")
  })

  it("차량", () => {
    const v = { plate_no: "서울86바7754", driver_name: "김진승", driver_phone: null, vehicle_type: "냉동탑", pallet_count: 3, memo: null } as unknown as VehicleRow
    expect(vehiclesTable([v])[1]).toEqual(["서울86바7754", "김진승", "", "냉동탑", 3, ""])
  })
})
