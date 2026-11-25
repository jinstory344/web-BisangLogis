import { Car, Truck } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { carLedgerHref } from "@/lib/car-ledger/url"
import type { CarRow } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

/**
 * 차 칩 줄: [🚚 내 트럭 · 12가3456] [🚗 승용차] … [⚙]. 보고 있는 달·보기는 그대로, 탭은 처음(정비)으로.
 * trailing: 줄 오른쪽 끝(차계부 설정 버튼).
 */
export function CarChips({
  cars,
  selectedId,
  from,
  to,
  view,
  trailing,
}: {
  cars: readonly CarRow[]
  selectedId: string
  from: string
  to: string
  /** 일일이 아닌 보기 (달력·주별·월별·연별) */
  view?: string
  trailing?: ReactNode
}) {
  return (
    <div className="-mx-4 flex items-center gap-1 pr-2">
      <nav aria-label="차 고르기" className="flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {cars.map((car) => {
          const isOn = car.id === selectedId
          const Icon = car.kind === "business" ? Truck : Car
          return (
            <Link
              key={car.id}
              href={carLedgerHref({ car: car.id, view, from, to })}
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
      {trailing}
    </div>
  )
}
