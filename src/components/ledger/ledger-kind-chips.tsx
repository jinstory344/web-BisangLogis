"use client"

import Link from "next/link"

import { chipVariants } from "@/components/form/choice-chips"
import { LEDGER_KIND_FILTERS, type LedgerKindFilter } from "@/lib/ledger"

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
    <nav aria-label="보기 거르기" className="flex gap-2">
      {LEDGER_KIND_FILTERS.map((filter) => (
        <Link
          key={filter.value}
          href={`/?view=day&d=${anchor}${filter.value === "all" ? "" : `&kind=${filter.value}`}`}
          aria-current={value === filter.value ? "true" : undefined}
          className={chipVariants({ selected: value === filter.value })}
        >
          {filter.label}
        </Link>
      ))}
    </nav>
  )
}
