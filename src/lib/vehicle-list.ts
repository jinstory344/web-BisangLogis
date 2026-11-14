import type { VehicleRow } from "@/lib/supabase/database.types"

/** 차량 정보 상단 고정 최대 대수 */
export const MAX_PINNED_VEHICLES = 10

export type VehicleSort = "recent" | "dispatch" | "plate" | "name"
export type SortDir = "asc" | "desc"

export const VEHICLE_SORT_OPTIONS: { value: VehicleSort; label: string }[] = [
  { value: "recent", label: "최근 등록" },
  { value: "dispatch", label: "자주 배차" },
  { value: "plate", label: "차량번호" },
  { value: "name", label: "이름" },
]

/** 정렬마다 처음 누르면 나오는 방향: 최근·자주는 많은/새 것부터, 번호·이름은 가나다순 */
const DEFAULT_DIR: Record<VehicleSort, SortDir> = {
  recent: "desc",
  dispatch: "desc",
  plate: "asc",
  name: "asc",
}

export function parseVehicleSort(params: { sort?: string; dir?: string }): {
  sort: VehicleSort
  dir: SortDir
} {
  const sort = VEHICLE_SORT_OPTIONS.some((o) => o.value === params.sort)
    ? (params.sort as VehicleSort)
    : "recent"
  const dir = params.dir === "asc" || params.dir === "desc" ? params.dir : DEFAULT_DIR[sort]
  return { sort, dir }
}

export function defaultSortDir(sort: VehicleSort): SortDir {
  return DEFAULT_DIR[sort]
}

const collator = new Intl.Collator("ko")

export function sortVehicles<T extends Pick<VehicleRow, "id" | "plate_no" | "driver_name" | "created_at">>(
  vehicles: T[],
  sort: VehicleSort,
  dir: SortDir,
  dispatchCounts: Map<string, number> = new Map()
): T[] {
  const sign = dir === "asc" ? 1 : -1
  const compare = (a: T, b: T): number => {
    switch (sort) {
      case "dispatch":
        return (dispatchCounts.get(a.id) ?? 0) - (dispatchCounts.get(b.id) ?? 0)
      case "plate":
        return collator.compare(a.plate_no, b.plate_no)
      case "name":
        return collator.compare(a.driver_name, b.driver_name)
      default:
        return a.created_at.localeCompare(b.created_at)
    }
  }
  // 같은 값이면 차량번호 가나다순으로 늘 같은 자리에
  return [...vehicles].sort((a, b) => sign * compare(a, b) || collator.compare(a.plate_no, b.plate_no))
}

/** 복사 버튼: 차량번호 / 이름 / 전화번호(숫자만) 세 줄 — 메시지에 바로 붙여 넣기 좋게 */
export function vehicleCopyText(v: Pick<VehicleRow, "plate_no" | "driver_name" | "driver_phone">): string {
  return [v.plate_no, v.driver_name, (v.driver_phone ?? "").replace(/\D/g, "")]
    .filter(Boolean)
    .join("\n")
}

/** 고정 목록(순서대로 id)에서 하나를 위(-1)·아래(+1)로 옮긴 새 순서. 끝이면 그대로. */
export function movePinned(ids: string[], id: string, delta: -1 | 1): string[] {
  const from = ids.indexOf(id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= ids.length) return ids
  const next = [...ids]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

/** 고정 켜기·끄기 후의 새 순서. 켤 때는 맨 아래에 붙인다. 10대가 넘으면 null. */
export function togglePinned(ids: string[], id: string): string[] | null {
  if (ids.includes(id)) return ids.filter((x) => x !== id)
  if (ids.length >= MAX_PINNED_VEHICLES) return null
  return [...ids, id]
}
