"use client"

import { ChevronDown } from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useState } from "react"

import { chipVariants } from "@/components/form/choice-chips"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { ItemCount } from "@/lib/car-ledger/stats"
import { formatKRW } from "@/lib/money"
import { cn } from "@/lib/utils"

/** 칩 줄에 바로 보이는 항목 수 (나머지는 더보기) */
const TOP_COUNT = 4
const CHIP_CLASS = "min-h-9 px-3 text-[13px] md:min-h-8"

/**
 * 정비 탭 항목 칩: `전체` + 많이 한 항목 4개(횟수) + `더보기 ▾`(아래 판에 모든 항목·횟수·합계).
 * 고른 항목이 상위 4개 밖이면 그 칩도 함께 보인다.
 */
export function ItemChips({ counts, selected }: { counts: ItemCount[]; selected: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)

  function hrefFor(item: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (item) params.set("item", item)
    else params.delete("item")
    return `${pathname}?${params.toString()}`
  }

  const top = counts.slice(0, TOP_COUNT)
  const extra = selected && !top.some((row) => row.item === selected)
    ? (counts.find((row) => row.item === selected) ?? { item: selected, count: 0, total: 0 })
    : null
  const shown = extra ? [...top, extra] : top

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Link
          href={hrefFor("")}
          replace
          scroll={false}
          className={cn(chipVariants({ selected: selected === "" }), CHIP_CLASS)}
        >
          전체
        </Link>
        {shown.map((row) => (
          <Link
            key={row.item}
            href={hrefFor(row.item)}
            replace
            scroll={false}
            className={cn(chipVariants({ selected: selected === row.item }), CHIP_CLASS)}
          >
            {row.item}
            <span className="text-[11px] tabular-nums opacity-70">{row.count}</span>
          </Link>
        ))}
        {counts.length > TOP_COUNT ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={cn(chipVariants({ selected: false }), CHIP_CLASS)}
          >
            더보기
            <ChevronDown className="size-3.5" />
          </button>
        ) : null}
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] gap-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="pr-12">
            <SheetTitle>정비 항목</SheetTitle>
            <SheetDescription>고르면 그 항목의 전체 이력을 보여 줘요</SheetDescription>
          </SheetHeader>
          <ul className="overflow-y-auto px-2">
            {counts.map((row) => (
              <li key={row.item}>
                <Link
                  href={hrefFor(row.item)}
                  replace
                  scroll={false}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm active:bg-muted",
                    selected === row.item && "bg-muted font-semibold"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{row.item}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{row.count}회</span>
                  <span className="w-28 shrink-0 text-right tabular-nums">{formatKRW(row.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  )
}
