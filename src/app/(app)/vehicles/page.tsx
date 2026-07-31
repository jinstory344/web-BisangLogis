import Link from "next/link"
import { Plus } from "lucide-react"

import { SearchBox } from "@/components/common/search-box"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import type { VehicleRow } from "@/lib/supabase/database.types"

import { VehicleList } from "./vehicle-list"

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim() ?? ""

  const supabase = await createClient()
  let request = supabase
    .from("vehicles")
    .select("*")
    .is("deleted_at", null)
    .order("plate_no")

  if (query) {
    request = request.or(`plate_no.ilike.%${query}%,driver_name.ilike.%${query}%`)
  }

  const { data, error } = await request

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">차량·기사 관리</h1>
        <Button asChild size="sm">
          <Link href="/vehicles/new">
            <Plus />
            차량 등록
          </Link>
        </Button>
      </div>

      <div className="mt-4">
        <SearchBox defaultValue={query} placeholder="차량번호 또는 기사명 검색" />
      </div>

      {error ? (
        <p className="mt-6 text-sm text-destructive">
          차량 목록을 불러오지 못했습니다: {error.message}
        </p>
      ) : (
        <div className="mt-4">
          <VehicleList vehicles={(data ?? []) as VehicleRow[]} />
        </div>
      )}
    </div>
  )
}
