"use client"

import { chipVariants } from "@/components/form/choice-chips"
import { UNDER_STICKY_HEAD } from "@/components/layout/sticky-head"
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
  count,
}: {
  value: LedgerKindFilter
  onChange: (next: LedgerKindFilter) => void
  /** 지금 고른 거르기의 건수 (칩 줄 오른쪽 끝에 "12건") */
  count: number
}) {
  return (
    // 위 고정 머리 바로 밑에 붙어 함께 고정된다. 날짜 줄(z-10)이 밀려 올라올 때 이 줄 아래로 들어가게 한 층 위(z-20)
    <nav
      aria-label="보기 거르기"
      className={cn("sticky z-20 -mx-4 flex items-center gap-1.5 border-b border-red-400/70 bg-background px-4 py-2 md:-mx-6 md:px-6", UNDER_STICKY_HEAD)}
    >
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
      <span className="ml-auto text-sm text-muted-foreground tabular-nums">{count}건</span>
    </nav>
  )
}
