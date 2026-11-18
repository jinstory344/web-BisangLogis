import { CARGO_BOX_TYPE_LABELS } from "@/lib/constants/cargo-box-type"
import type { CargoBoxType, VehicleRow } from "@/lib/supabase/database.types"

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

export interface VehicleDispatchItem {
  id: string
  dispatch_date: string
  origin: string
  destination: string
  freight_amount: number | null
  client_name: string | null
}

/** 차량 판에 미리 넣어 두는 최근 배차 (차량마다 이만큼까지) */
export const RECENT_DISPATCHES_PER_VEHICLE = 50

/**
 * 최근 배차들(최근 날짜부터)을 차량별로 나눈다: 차량에 연결된 배차, 또는 연결 없이 같은 번호로 적힌 배차.
 * 차량마다 RECENT_DISPATCHES_PER_VEHICLE건까지 담고, total은 받은 배차 안에서 센 건수.
 */
export function groupRecentDispatchesByVehicle(
  vehicles: readonly { id: string; plate_no: string }[],
  dispatches: readonly {
    id: string
    dispatch_date: string
    origin: string
    destination: string
    freight_amount: number | null
    client_id: string | null
    vehicle_id: string | null
    plate_no_snapshot: string | null
  }[],
  clientNames: ReadonlyMap<string, string>
): Record<string, { items: VehicleDispatchItem[]; total: number; freightSum: number }> {
  const byPlate = new Map(vehicles.map((v) => [v.plate_no.replace(/\s/g, ""), v.id]))
  const known = new Set(vehicles.map((v) => v.id))
  const result: Record<string, { items: VehicleDispatchItem[]; total: number; freightSum: number }> = {}
  for (const d of dispatches) {
    const vehicleId =
      d.vehicle_id && known.has(d.vehicle_id)
        ? d.vehicle_id
        : d.plate_no_snapshot
          ? byPlate.get(d.plate_no_snapshot.replace(/\s/g, ""))
          : undefined
    if (!vehicleId) continue
    const bucket = (result[vehicleId] ??= { items: [], total: 0, freightSum: 0 })
    bucket.total += 1
    bucket.freightSum += d.freight_amount ?? 0
    if (bucket.items.length < RECENT_DISPATCHES_PER_VEHICLE) {
      bucket.items.push({
        id: d.id,
        dispatch_date: d.dispatch_date,
        origin: d.origin,
        destination: d.destination,
        freight_amount: d.freight_amount,
        client_name: d.client_id ? (clientNames.get(d.client_id) ?? null) : null,
      })
    }
  }
  return result
}

/**
 * 배차에서 고른 차종·파렛 → 연결된 차량 정보에 넣을 값. 바뀔 게 없으면 null.
 * 배차에 적은 것만 넣고(빈 칸은 차량 정보를 지우지 않는다), "기타"는 차량 차종에 없어 넣지 않는다.
 */
export function vehicleSpecFromDispatch(
  dispatch: { cargo_box_type: CargoBoxType | "" | null; pallet_count: number | null },
  current: { vehicle_type: string | null; pallet_count: number | null }
): { vehicle_type?: string; pallet_count?: number } | null {
  const patch: { vehicle_type?: string; pallet_count?: number } = {}
  const type =
    dispatch.cargo_box_type && dispatch.cargo_box_type !== "OTHER"
      ? CARGO_BOX_TYPE_LABELS[dispatch.cargo_box_type]
      : null
  if (type && type !== current.vehicle_type) patch.vehicle_type = type
  const pallets = dispatch.pallet_count
  // 차량 정보의 파렛수는 1~99만 받는다
  if (pallets !== null && pallets >= 1 && pallets <= 99 && pallets !== current.pallet_count) patch.pallet_count = pallets
  return Object.keys(patch).length > 0 ? patch : null
}
