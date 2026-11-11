import Link from "next/link"
import { Plus } from "lucide-react"

import { SearchBox } from "@/components/common/search-box"
import { Button } from "@/components/ui/button"
import { parseClientCategoryFilter } from "@/lib/constants/client"
import { createClient } from "@/lib/supabase/server"
import type { ClientRow } from "@/lib/supabase/database.types"

import { ClientCategoryFilterChips } from "./client-category-filter"
import { ClientList } from "./client-list"

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>
}) {
  const { q, category } = await searchParams
  const query = q?.trim() ?? ""
  const categoryFilter = parseClientCategoryFilter(category)

  const supabase = await createClient()
  let request = supabase
    .from("clients")
    .select("*")
    .is("deleted_at", null)
    .order("name")

  if (query) {
    request = request.or(`name.ilike.%${query}%,biz_no.ilike.%${query}%`)
  }
  if (categoryFilter !== "ALL") {
    request = request.eq("category", categoryFilter)
  }

  const { data, error } = await request

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">거래처 관리</h1>
        <Button asChild size="sm">
          <Link href="/clients/new">
            <Plus />
            거래처 등록
          </Link>
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <ClientCategoryFilterChips />
        <SearchBox
          defaultValue={query}
          placeholder="거래처명 또는 사업자번호 검색"
        />
      </div>

      {error ? (
        <p className="mt-6 text-sm text-destructive">
          거래처 목록을 불러오지 못했습니다: {error.message}
        </p>
      ) : (
        <div className="mt-4">
          <ClientList clients={(data ?? []) as ClientRow[]} />
        </div>
      )}
    </div>
  )
}
