import Link from "next/link"

import type { CarTab } from "@/lib/car-ledger/tabs"
import { carLedgerHref } from "@/lib/car-ledger/url"
import { cn } from "@/lib/utils"

/** 탭 줄 (통계 화면 탭과 같은 모양). 종류가 많으면 옆으로 밀어 본다. */
export function TabsNav({
  tabs,
  current,
  car,
  from,
  to,
}: {
  tabs: readonly CarTab[]
  current: string
  car: string
  from: string
  to: string
}) {
  return (
    <nav
      aria-label="차계부 보기"
      className="-mx-4 flex overflow-x-auto border-b px-2 [scrollbar-width:none] md:mx-0 md:px-0"
    >
      {tabs.map((tab) => {
        const isActive = tab.value === current
        return (
          <Link
            key={tab.value}
            href={carLedgerHref({ car, from, to, tab: tab.value })}
            replace
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex min-h-10 flex-1 shrink-0 items-center justify-center px-3 text-sm whitespace-nowrap transition-colors",
              isActive ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {isActive ? (
              <span aria-hidden className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[#9b7fd1]" />
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
