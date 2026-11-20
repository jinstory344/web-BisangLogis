"use client"

import { usePathname } from "next/navigation"

import { HomeTitle } from "@/components/layout/home-title"
import { ListBodyFallback } from "@/components/list/list-body-fallback"
import { PageLoading } from "@/components/list/page-loading"

/** HOME은 제목까지, 그 밖의 화면(매출·지출·통계 등)은 흐린 줄만 */
export default function Loading() {
  const pathname = usePathname()
  if (pathname === "/") return <PageLoading title={<HomeTitle />} barClassName="bg-red-400" />
  return (
    <div aria-busy className="mx-auto max-w-2xl p-4 md:p-6">
      <ListBodyFallback />
    </div>
  )
}
