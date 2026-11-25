import { describe, expect, it } from "vitest"

import {
  buildCarLogFormData,
  carLogFormDefaults,
  carLogFormSchema,
  coerceCarLogFormData,
} from "./car-log"

const submit = (values: ReturnType<typeof carLogFormDefaults>) =>
  carLogFormSchema.safeParse(
    coerceCarLogFormData(Object.fromEntries(buildCarLogFormData(values)) as Record<string, FormDataEntryValue>)
  )

describe("차계부 기록 폼", () => {
  it("폼 → FormData → 검증을 왕복한다", () => {
    const values = {
      ...carLogFormDefaults("car-1", "정비", "2026-11-25"),
      amount: 120000,
      odometer_km: "85,200",
      service_items: [{ item: "엔진오일", amount: 90000 }],
    }
    const parsed = submit(values)
    expect(parsed.success).toBe(true)
    expect(parsed.data?.service_items).toEqual([{ item: "엔진오일", amount: 90000 }])
    expect(parsed.data?.amount).toBe(120000)
  })

  it("리터·km 글자가 잘못되면 실패", () => {
    expect(submit({ ...carLogFormDefaults("c", "주유", "2026-11-25"), liters: "많이" }).success).toBe(false)
    expect(submit({ ...carLogFormDefaults("c", "주유", "2026-11-25"), odometer_km: "1.5" }).success).toBe(false)
  })

  it("종류가 비면 실패", () => {
    expect(submit(carLogFormDefaults("c", "", "2026-11-25")).success).toBe(false)
  })
})
