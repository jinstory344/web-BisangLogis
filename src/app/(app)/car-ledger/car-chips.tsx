import { Car, Truck } from "lucide-react"
import Link from "next/link"

import { carLedgerHref } from "@/lib/car-ledger/url"
import type { CarRow } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

/** 차 칩 줄: [🚚 내 트럭 · 12가3456] [🚗 승용차]. 보고 있는 달은 그대로, 탭은 처음(정비)으로. */
export function CarChips({
  cars,
  selectedId,
  from,
  to,
}: {
  cars: readonly CarRow[]
  selectedId: string
  from: string
  to: string
}) {
  return (
    <nav aria-label="차 고르기" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
      {cars.map((car) => {
        const isOn = car.id === selectedId
        const Icon = car.kind === "business" ? Truck : Car
        return (
          <Link
            key={car.id}
            href={carLedgerHref({ car: car.id, from, to })}
            replace
            aria-current={isOn ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] whitespace-nowrap transition-colors",
              isOn
                ? "border-[#9b7fd1] bg-[#3b2f57] font-semibold text-[#e4dbf7]"
                : "border-input bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            <Icon className="size-4" aria-hidden />
            {car.name}
            {car.plate_no ? <span className="font-normal opacity-80">· {car.plate_no}</span> : null}
          </Link>
        )
      })}
    </nav>
  )
}
