import { describe, expect, it } from "vitest"

import {
  movePinned,
  parseVehicleSort,
  sortVehicles,
  togglePinned,
  vehicleCopyText,
} from "@/lib/vehicle-list"

const v = (id: string, plate_no: string, driver_name: string, created_at: string) => ({
  id,
  plate_no,
  driver_name,
  created_at,
})
const list = [
  v("a", "서울86바1234", "김철수", "2026-01-02"),
  v("b", "12가3456", "홍길동", "2026-03-01"),
  v("c", "경기91아5678", "강호동", "2026-02-01"),
]

describe("parseVehicleSort", () => {
  it("모르는 값은 최근 등록·내림차순, 정렬마다 기본 방향", () => {
    expect(parseVehicleSort({})).toEqual({ sort: "recent", dir: "desc" })
    expect(parseVehicleSort({ sort: "name" })).toEqual({ sort: "name", dir: "asc" })
    expect(parseVehicleSort({ sort: "plate", dir: "desc" })).toEqual({ sort: "plate", dir: "desc" })
    expect(parseVehicleSort({ sort: "x", dir: "y" })).toEqual({ sort: "recent", dir: "desc" })
  })
})

describe("sortVehicles", () => {
  it("최근 등록 내림차순", () => {
    expect(sortVehicles(list, "recent", "desc").map((x) => x.id)).toEqual(["b", "c", "a"])
  })
  it("이름 가나다순과 반대", () => {
    expect(sortVehicles(list, "name", "asc").map((x) => x.id)).toEqual(["c", "a", "b"])
    expect(sortVehicles(list, "name", "desc").map((x) => x.id)).toEqual(["b", "a", "c"])
  })
  it("자주 배차: 배차 수 많은 순, 같으면 차량번호순", () => {
    const counts = new Map([["a", 5], ["c", 5]])
    expect(sortVehicles(list, "dispatch", "desc", counts).map((x) => x.id)).toEqual(["c", "a", "b"])
  })
})

describe("vehicleCopyText", () => {
  it("차량번호·이름·숫자만 전화번호 세 줄", () => {
    expect(
      vehicleCopyText({ plate_no: "서울86바7754", driver_name: "김진승", driver_phone: "010-2746-0344" })
    ).toBe("서울86바7754\n김진승\n01027460344")
  })
  it("전화번호가 없으면 두 줄", () => {
    expect(vehicleCopyText({ plate_no: "12가3456", driver_name: "홍길동", driver_phone: null })).toBe(
      "12가3456\n홍길동"
    )
  })
})

describe("고정 순서", () => {
  it("위·아래로 옮기고 끝에서는 그대로", () => {
    expect(movePinned(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"])
    expect(movePinned(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"])
    expect(movePinned(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"])
  })
  it("켜면 맨 아래, 끄면 빠짐, 10대면 더 못 켬", () => {
    expect(togglePinned(["a"], "b")).toEqual(["a", "b"])
    expect(togglePinned(["a", "b"], "a")).toEqual(["b"])
    const ten = Array.from({ length: 10 }, (_, i) => `p${i}`)
    expect(togglePinned(ten, "new")).toBeNull()
    expect(togglePinned(ten, "p3")).toHaveLength(9)
  })
})
