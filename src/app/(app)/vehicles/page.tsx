import Link from "next/link"
import { Plus } from "lucide-react"

import { SearchBox } from "@/components/common/search-box"
import { createClient } from "@/lib/supabase/server"
import type { VehicleRow } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"
import {
  defaultSortDir,
  parseVehicleSort,
  sortVehicles,
  VEHICLE_SORT_OPTIONS,
} from "@/lib/vehicle-list"

import { VehicleList } from "./vehicle-list"

function hrefWith(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value)
  const text = search.toString()
  return text ? `/vehicles?${text}` : "/vehicles"
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string }>
}) {
  const params = await searchParams
  const query = params.q?.trim() ?? ""
  const { sort, dir } = parseVehicleSort(params)

  const supabase = await createClient()
  let request = supabase.from("vehicles").select("*").is("deleted_at", null)
  if (query) {
    request = request.or(`plate_no.ilike.%${query}%,driver_name.ilike.%${query}%`)
  }

  // "자주 배차" 정렬일 때만 차량별 배차 수를 센다 (Supabase는 한 번에 1000줄까지라 나눠 읽는다)
  async function countDispatchesByVehicle(): Promise<Map<string, number>> {
    const counts = new Map<string, number>()
    for (let from = 0; ; from += 1000) {
      const { data: rows } = await supabase
        .from("dispatches")
        .select("vehicle_id")
        .is("deleted_at", null)
        .not("vehicle_id", "is", null)
        .order("id")
        .range(from, from + 999)
      for (const row of rows ?? []) {
        if (row.vehicle_id) counts.set(row.vehicle_id, (counts.get(row.vehicle_id) ?? 0) + 1)
      }
      if (!rows || rows.length < 1000) return counts
    }
  }

  const [{ data, error }, counts] = await Promise.all([
    request,
    sort === "dispatch" ? countDispatchesByVehicle() : Promise.resolve(new Map<string, number>()),
  ])

  const vehicles = (data ?? []) as VehicleRow[]
  const pinned = vehicles
    .filter((v) => v.pin_order !== null)
    .sort((a, b) => (a.pin_order ?? 0) - (b.pin_order ?? 0))
  const others = sortVehicles(
    vehicles.filter((v) => v.pin_order === null),
    sort,
    dir,
    counts
  )

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">차량 정보</h1>
        <Link
          href="/vehicles/new"
          prefetch
          aria-label="차량 등록"
          className="-mr-2 flex size-10 items-center justify-center rounded-full text-foreground hover:bg-muted"
        >
          <Plus className="size-7" strokeWidth={1.75} />
        </Link>
      </div>

      <div className="mt-3">
        <SearchBox defaultValue={query} placeholder="차량번호 또는 이름 검색" />
      </div>

      <div className="mt-2.5 flex gap-1.5 overflow-x-auto">
        {VEHICLE_SORT_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={hrefWith({ q: query || undefined, sort: option.value === "recent" ? undefined : option.value })}
            replace
            scroll={false}
            prefetch
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[13px]",
              option.value === sort
                ? "bg-foreground font-semibold text-background"
                : "bg-muted text-muted-foreground"
            )}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {error ? (
        <p className="mt-6 text-sm text-destructive">
          차량 목록을 불러오지 못했습니다: {error.message}
        </p>
      ) : (
        <div className="mt-2">
          <VehicleList
            pinned={pinned}
            others={others}
            sortDir={dir}
            sortDirHref={hrefWith({
              q: query || undefined,
              sort: sort === "recent" ? undefined : sort,
              dir: dir === defaultSortDir(sort) ? (dir === "asc" ? "desc" : "asc") : undefined,
            })}
          />
        </div>
      )}
    </div>
  )
}
