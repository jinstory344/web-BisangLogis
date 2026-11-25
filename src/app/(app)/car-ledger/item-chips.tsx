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

const CHIP_CLASS = "min-h-9 px-3 text-[13px] md:min-h-8"

/**
 * 정비 탭 항목 고르기: 칩 하나 `[전체 ▾]`(고르면 `[엔진오일 12 ▾]`). 누르면 아래 판에 전체 + 모든 항목(횟수·합계).
 * 항목이 늘어도 줄이 길어지지 않게 다른 화면의 거르기 칩과 같은 방식(사용자 요청).
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

  const current = selected ? counts.find((row) => row.item === selected) : null

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label={`정비 항목: ${selected || "전체"}, 바꾸기`}
          className={cn(chipVariants({ selected: selected !== "" }), CHIP_CLASS)}
        >
          {selected || "전체"}
          {current ? <span className="text-[11px] tabular-nums opacity-70">{current.count}</span> : null}
          <ChevronDown className="size-3.5" />
        </button>
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] gap-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="pr-12">
            <SheetTitle>정비 항목</SheetTitle>
            <SheetDescription>고르면 그 항목의 전체 이력을 보여 줘요</SheetDescription>
          </SheetHeader>
          <ul className="overflow-y-auto px-2">
            <li>
              <Link
                href={hrefFor("")}
                replace
                scroll={false}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm active:bg-muted",
                  selected === "" && "bg-muted font-semibold"
                )}
              >
                전체
              </Link>
            </li>
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
