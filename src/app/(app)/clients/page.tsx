import Link from "next/link"
import { Plus } from "lucide-react"

import { SearchBox } from "@/components/common/search-box"
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
    request = request.or(`name.ilike.%${query}%,biz_no.ilike.%${query}%,contact_name.ilike.%${query}%`)
  }

  const { data, error } = await request

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">거래처</h1>
        <Link
          href="/clients/new"
          prefetch
          aria-label="거래처 등록"
          className="-mr-2 flex size-10 items-center justify-center rounded-full text-foreground hover:bg-muted"
        >
          <Plus className="size-7" strokeWidth={1.75} />
        </Link>
      </div>

      <div className="mt-3">
        <SearchBox defaultValue={query} placeholder="거래처명 또는 담당자 검색" />
      </div>

      {error ? (
        <p className="mt-6 text-sm text-destructive">
          거래처 목록을 불러오지 못했습니다: {error.message}
        </p>
      ) : (
        <div className="mt-2">
          <ClientList clients={(data ?? []) as ClientRow[]} />
        </div>
      )}
    </div>
  )
}
