import Link from "next/link"
import { Plus } from "lucide-react"

import { SearchBox } from "@/components/common/search-box"
import { SearchButton } from "@/components/layout/search-button"
import { createClient } from "@/lib/supabase/server"
import type { ClientRow } from "@/lib/supabase/database.types"

import { getClientContacts } from "./actions"
import { ClientList } from "./client-list"
import { SECTION_COLORS } from "@/lib/constants/section-colors"
import { cn } from "@/lib/utils"

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
  const contactsByClient = await getClientContacts((data ?? []).map((c) => c.id))

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      {/* 모바일: 배차·HOME과 같은 머리 (왼쪽 통합검색 · 가운데 제목 · 오른쪽 등록). 데스크톱: 왼쪽 큰 제목 + 오른쪽 등록 */}
      <div className="mt-2 grid h-10 grid-cols-[2.5rem_1fr_2.5rem] items-center md:mt-0 md:flex md:h-auto md:justify-between md:gap-4">
        <span className="md:hidden">
          <SearchButton />
        </span>
        <h1 className={cn("text-center text-xl font-bold tracking-tight md:text-left md:text-2xl md:tracking-normal", SECTION_COLORS.client.title)}>거래처</h1>
        <Link
          href="/clients/new"
          prefetch
          aria-label="거래처 등록"
          className={cn("flex size-10 items-center justify-center justify-self-end rounded-full hover:bg-muted md:-mr-2", SECTION_COLORS.client.accent)}
        >
          <Plus className="size-6" strokeWidth={1.75} />
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
          <ClientList clients={(data ?? []) as ClientRow[]} contactsByClient={contactsByClient} />
        </div>
      )}
    </div>
  )
}
