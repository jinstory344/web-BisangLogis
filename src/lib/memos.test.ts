import { describe, expect, it } from "vitest"

import type { DispatchRow } from "@/lib/supabase/database.types"

import { buildDispatchInfo, formatManwon, matchRouteMemo, smsHref, sortMemos } from "./memos"

const dispatch = {
  dispatch_date: "2026-11-17",
  origin: "인천남동",
  destination: "광주 삼진냉장",
  cargo_box_type: "REFRIGERATED",
  pallet_count: 3,
  weight_ton: null,
  plate_no_snapshot: "서울86바7754",
  driver_name_snapshot: "김진승",
  driver_phone_snapshot: "010-2746-0344",
  freight_amount: 180000,
} as DispatchRow

describe("memos", () => {
  it("운임을 만원 단위로", () => {
    expect(formatManwon(180000)).toBe("18만원")
    expect(formatManwon(185000)).toBe("18만5천원")
    expect(formatManwon(1200000)).toBe("120만원")
    expect(formatManwon(123456)).toBe("123,456원")
  })

  it("배차정보 문구 — 보내 준 예시 모양 그대로", () => {
    expect(buildDispatchInfo(dispatch)).toBe(
      "[11월 17일 화요일]\n인천남동 - 광주 삼진냉장\n냉동3p\n서울86바7754\n김진승\n01027460344\n운임18만원"
    )
  })

  it("빈 칸은 줄째로 뺀다", () => {
    const bare = {
      ...dispatch,
      cargo_box_type: null,
      pallet_count: null,
      plate_no_snapshot: null,
      driver_phone_snapshot: "",
      freight_amount: null,
    } as DispatchRow
    expect(buildDispatchInfo(bare)).toBe("[11월 17일 화요일]\n인천남동 - 광주 삼진냉장\n김진승")
  })

  it("경로에 맞는 배차메모 고르기", () => {
    const memos = [
      { id: "a", title: "서류 안내", client_id: null },
      { id: "b", title: "인천남동 - 광주 삼진냉장", client_id: "c1" },
      { id: "c", title: "광주삼진냉장", client_id: null },
      { id: "d", title: "인천남동 - 동탄CJ", client_id: "c1" },
    ]
    expect(matchRouteMemo(memos, "인천남동", "광주 삼진냉장")).toBe("b")
    // 하차지만 맞으면 거래처 메모가 공통 메모보다 앞선다
    expect(matchRouteMemo(memos, "부산", "광주 삼진냉장")).toBe("b")
    expect(matchRouteMemo(memos.filter((m) => m.client_id === null), "부산", "광주 삼진냉장")).toBe("c")
    expect(matchRouteMemo(memos, "인천남동", "평택")).toBeNull()
  })

  it("문자 주소", () => {
    expect(smsHref("010-2746-0344", "안녕 하세요", true)).toBe("sms:01027460344&body=%EC%95%88%EB%85%95%20%ED%95%98%EC%84%B8%EC%9A%94")
    expect(smsHref(null, "a", false)).toBe("sms:?body=a")
  })

  it("고정 먼저, 그다음 최근 순", () => {
    const rows = [
      { id: "1", pinned: false, created_at: "2026-01-01", updated_at: "2026-03-01" },
      { id: "2", pinned: true, created_at: "2026-01-01", updated_at: null },
      { id: "3", pinned: false, created_at: "2026-02-01", updated_at: null },
    ]
    expect(sortMemos(rows).map((r) => r.id)).toEqual(["2", "1", "3"])
  })
})
