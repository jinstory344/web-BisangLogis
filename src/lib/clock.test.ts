import { describe, expect, it } from "vitest"

import { formatSeoulClock } from "./clock"

describe("formatSeoulClock", () => {
  it("서울 시간 MM-DD 요일 HH:MM:SS", () => {
    // 2026-11-17 00:15:32 UTC = 서울 09:15:32 (화)
    expect(formatSeoulClock(new Date("2026-11-17T00:15:32Z"))).toBe("11-17 TUE 09:15:32")
    // 자정 넘김: 2026-11-17 15:00:05 UTC = 서울 11-18 00:00:05 (수)
    expect(formatSeoulClock(new Date("2026-11-17T15:00:05Z"))).toBe("11-18 WED 00:00:05")
  })
})
