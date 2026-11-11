"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { chipVariants } from "@/components/form/choice-chips"
import {
  CLIENT_CATEGORY_LABELS,
  parseClientCategoryFilter,
  type ClientCategoryFilter,
} from "@/lib/constants/client"
import { cn } from "@/lib/utils"

const FILTERS: { value: ClientCategoryFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "MINE", label: CLIENT_CATEGORY_LABELS.MINE },
  { value: "OTHER", label: CLIENT_CATEGORY_LABELS.OTHER },
]

/**
 * 거래처 목록의 구분 필터 칩 (전체 / 내 거래처 / 타 거래처).
 * 주소의 ?category= 로 걸러서 새로고침해도 유지되고, 검색어(?q=)는 그대로 둔다.
 */
export function ClientCategoryFilterChips() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = parseClientCategoryFilter(
    searchParams.get("category") ?? undefined
  )

  function hrefFor(value: ClientCategoryFilter): string {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "ALL") {
      params.delete("category")
    } else {
      params.set("category", value)
    }
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }

  return (
    <nav aria-label="거래처 구분" className="flex flex-wrap gap-2">
      {FILTERS.map((filter) => {
        const isActive = filter.value === current
        return (
          <Link
            key={filter.value}
            href={hrefFor(filter.value)}
            replace
            aria-current={isActive ? "page" : undefined}
            className={cn(chipVariants({ selected: isActive }))}
          >
            {filter.label}
          </Link>
        )
      })}
    </nav>
  )
}
