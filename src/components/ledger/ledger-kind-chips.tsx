"use client"

import Link from "next/link"

import { chipVariants } from "@/components/form/choice-chips"
import { LIST_CHIP_CLASS } from "@/components/list/list-page-head"
import { LEDGER_KIND_FILTERS, type LedgerKindFilter } from "@/lib/ledger"
import { cn } from "@/lib/utils"

/**
 * 일일 장부 거르기 칩: 전체 · 매출 · 지출 · 미입금.
 * (chipVariants가 클라이언트 모듈에 있어 서버 컴포넌트에서 직접 쓸 수 없으므로 클라이언트 컴포넌트로 둔다.)
 */
export function LedgerKindChips({
  anchor,
  value,
}: {
  anchor: string
  value: LedgerKindFilter
}) {
  return (
    <nav aria-label="보기 거르기" className="flex gap-1.5 py-2">
      {LEDGER_KIND_FILTERS.map((filter) => (
        <Link
          key={filter.value}
          href={`/?view=day&d=${anchor}${filter.value === "all" ? "" : `&kind=${filter.value}`}`}
          aria-current={value === filter.value ? "true" : undefined}
          className={cn(
            chipVariants({ selected: value === filter.value }),
            LIST_CHIP_CLASS
          )}
        >
          {filter.label}
        </Link>
      ))}
    </nav>
  )
}
