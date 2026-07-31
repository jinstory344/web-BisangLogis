import Link from "next/link"
import { Plus } from "lucide-react"

import { SearchBox } from "@/components/common/search-box"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import type { ClientRow } from "@/lib/supabase/database.types"

import { ClientList } from "./client-list"

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim() ?? ""

  const supabase = await createClient()
  let request = supabase
    .from("clients")
    .select("*")
    .is("deleted_at", null)
    .order("name")

  if (query) {
    request = request.or(`name.ilike.%${query}%,biz_no.ilike.%${query}%`)
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

      <div className="mt-4">
        <SearchBox
          defaultValue={query}
          placeholder="사업자명 또는 사업자번호 검색"
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
