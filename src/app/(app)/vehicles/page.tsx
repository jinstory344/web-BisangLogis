import Link from "next/link"
import { Plus } from "lucide-react"

import { SearchBox } from "@/components/common/search-box"
import { PageTitle } from "@/components/layout/page-title"
import { SearchButton } from "@/components/layout/search-button"
import { createClient } from "@/lib/supabase/server"
import type { VehicleRow } from "@/lib/supabase/database.types"
import { SECTION_COLORS } from "@/lib/constants/section-colors"
import { cn } from "@/lib/utils"
import {
  groupRecentDispatchesByVehicle,
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

  // 차량 판의 "최근 배차"를 누르는 순간 바로 보이도록 목록과 함께 미리 받아 둔다(판을 열 때 서버를 다녀오지 않게).
  // shortcut: 최근 1000건 안에서만 차량별로 나눈다 — 더 오래된 건은 판 아래 "검색에서 전체 보기"로 본다.
  const [{ data, error }, counts, recentRes, clientsRes] = await Promise.all([
    request,
    sort === "dispatch" ? countDispatchesByVehicle() : Promise.resolve(new Map<string, number>()),
    supabase
      .from("dispatches")
      .select("id, dispatch_date, origin, destination, freight_amount, client_id, vehicle_id, plate_no_snapshot")
      .is("deleted_at", null)
      .order("dispatch_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("clients").select("id, name"),
  ])

  const vehicles = (data ?? []) as VehicleRow[]
  const recentDispatches = groupRecentDispatchesByVehicle(
    vehicles,
    recentRes.data ?? [],
    new Map((clientsRes.data ?? []).map((c) => [c.id, c.name]))
  )
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
      {/* 모바일: 배차·HOME과 같은 머리 (왼쪽 통합검색 · 가운데 제목 · 오른쪽 등록). 데스크톱: 왼쪽 큰 제목 + 오른쪽 등록 */}
      <div className="mt-2 grid h-10 grid-cols-[2.5rem_1fr_2.5rem] items-center md:mt-0 md:flex md:h-auto md:justify-between md:gap-4">
        <span className="md:hidden">
          <SearchButton />
        </span>
        <PageTitle title="차량 정보" barClassName={SECTION_COLORS.vehicle.titleBar} className="md:hidden" />
        <h1 className="hidden text-2xl font-semibold md:block">차량 정보</h1>
        <Link
          href="/vehicles/new"
          prefetch
          aria-label="차량 등록"
          className={cn("flex size-10 items-center justify-center justify-self-end rounded-full hover:bg-muted md:-mr-2", SECTION_COLORS.vehicle.accent)}
        >
          <Plus className="size-6" strokeWidth={1.75} />
        </Link>
      </div>

      <div className="mt-3">
        <SearchBox defaultValue={query} placeholder="차량번호 또는 이름 검색" />
      </div>

      <div className="mt-2.5 flex gap-1.5 overflow-x-auto">
        {VEHICLE_SORT_OPTIONS.filter((option) => option.value !== "name").map((option) => (
          <Link
            key={option.value}
            href={hrefWith({ q: query || undefined, sort: option.value === "recent" ? undefined : option.value })}
            replace
            scroll={false}
            prefetch
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[13px]",
              option.value === sort
                ? SECTION_COLORS.vehicle.chip
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
            recentDispatches={recentDispatches}
            sortDir={dir}
            isNameSort={sort === "name"}
            sortDirHref={hrefWith({
              q: query || undefined,
              sort: "name",
              // 이름순이면 방향만 뒤집고, 다른 정렬이면 이름 가나다순으로
              dir: sort === "name" && dir === "asc" ? "desc" : undefined,
            })}
          />
        </div>
      )}
    </div>
  )
}
