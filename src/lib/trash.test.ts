import { describe, expect, it } from "vitest"

import { trashDaysLeft } from "./trash"

describe("trashDaysLeft", () => {
  const now = new Date("2026-11-20T03:00:00Z")
  it("오늘 지웠으면 30일, 29일 전이면 1일, 30일 넘으면 0", () => {
    expect(trashDaysLeft("2026-11-20T01:00:00Z", now)).toBe(30)
    expect(trashDaysLeft("2026-10-22T03:00:00Z", now)).toBe(1)
    expect(trashDaysLeft("2026-08-05T00:00:00Z", now)).toBe(0)
  })
})
