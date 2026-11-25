import type { ReactNode } from "react"

import { ReturnToLink } from "@/components/common/return-to-link"
import type { CarEntry } from "@/lib/car-ledger/entries"
import { cn } from "@/lib/utils"

/** 기록을 누르면: 지출 기반 → 지출 수정, car_logs → 차계부 기록 수정. 저장하면 지금 차계부 화면으로 돌아온다. */
export function entryEditHref(entry: Pick<CarEntry, "source" | "id">): string {
  return entry.source === "expense" ? `/expenses/${entry.id}/edit` : `/car-ledger/log/${entry.id}`
}

export function EntryLink({
  entry,
  className,
  children,
}: {
  entry: Pick<CarEntry, "source" | "id">
  className?: string
  children: ReactNode
}) {
  return (
    <ReturnToLink
      href={entryEditHref(entry)}
      className={cn(
        "block transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/60",
        className
      )}
    >
      {children}
    </ReturnToLink>
  )
}
