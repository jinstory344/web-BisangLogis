"use client"

import { chipVariants } from "@/components/form/choice-chips"
import { LIST_CHIP_CLASS } from "@/components/list/list-page-head"
import { LEDGER_KIND_FILTERS, type LedgerKindFilter } from "@/lib/ledger"
import { cn } from "@/lib/utils"

/**
 * 일일 장부 거르기 칩: 전체 · 매출 · 지출 · 미입금.
 * 이미 받아 둔 그 달 내역을 화면에서 바로 거르므로 서버를 다시 부르지 않는다.
 */
export function LedgerKindChips({
  value,
  onChange,
}: {
  value: LedgerKindFilter
  onChange: (next: LedgerKindFilter) => void
}) {
  return (
    <nav aria-label="보기 거르기" className="flex gap-1.5 py-2">
      {LEDGER_KIND_FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          onClick={() => onChange(filter.value)}
          aria-pressed={value === filter.value}
          className={cn(
            chipVariants({ selected: value === filter.value }),
            LIST_CHIP_CLASS
          )}
        >
          {filter.label}
        </button>
      ))}
    </nav>
  )
}
