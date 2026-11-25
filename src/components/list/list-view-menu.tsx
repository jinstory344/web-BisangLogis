"use client"

import { Check, ChevronDown } from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useState } from "react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getCurrentMonthRangeInSeoul } from "@/lib/date"
import { LEDGER_VIEWS } from "@/lib/ledger"
import { listAnchor, parseListView, viewAnchorHref } from "@/lib/period-view"
import { cn } from "@/lib/utils"

/**
 * 매출·지출·배차·차계부 머리의 제목 옆 작은 보기 버튼 `일일 ▾`. 누르면 일일·달력·주별·월별·연별 메뉴(고른 것에 ✓).
 * 거르기 값은 그대로, 보고 있는 달(기준일)도 그대로 가지고 간다 (HOME 보기 탭과 같은 규칙).
 */
export function ListViewMenu() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const view = parseListView(searchParams.get("view") ?? undefined)
  const currentFrom = getCurrentMonthRangeInSeoul().from
  const anchor = listAnchor(searchParams.get("from") ?? "", searchParams.get("to") ?? "", currentFrom)
  const params = Object.fromEntries(searchParams.entries())
  const label = LEDGER_VIEWS.find((item) => item.value === view)?.label ?? "일일"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`보기: ${label}, 바꾸기`}
        className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-full bg-muted pr-1.5 pl-2.5 text-[13px] font-semibold whitespace-nowrap text-foreground"
      >
        {label}
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="center" className="w-40 p-1">
        {LEDGER_VIEWS.map((item) => {
          const isOn = item.value === view
          return (
            <Link
              key={item.value}
              href={viewAnchorHref(pathname, params, item.value, anchor)}
              onClick={() => setOpen(false)}
              aria-current={isOn ? "true" : undefined}
              className={cn(
                "flex h-10 items-center gap-2 rounded-md px-3 text-[15px] active:bg-muted md:hover:bg-muted",
                isOn && "font-semibold"
              )}
            >
              <Check className={cn("size-4 shrink-0", isOn ? "opacity-100" : "opacity-0")} aria-hidden />
              {item.label}
            </Link>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
