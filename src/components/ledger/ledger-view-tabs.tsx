import Link from "next/link"

import { LEDGER_VIEWS, type LedgerView } from "@/lib/ledger"
import { cn } from "@/lib/utils"

/** 장부 보기 전환: 일일 / 주별 / 월별 / 연별. 보고 있던 달(기준일)은 그대로 가지고 간다. */
export function LedgerViewTabs({
  view,
  anchor,
}: {
  view: LedgerView
  anchor: string
}) {
  return (
    <nav
      aria-label="Flow 보기"
      className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-[3px]"
    >
      {LEDGER_VIEWS.map((item) => {
        const isActive = item.value === view
        return (
          <Link
            key={item.value}
            href={`/?view=${item.value}&d=${anchor}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center justify-center rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
