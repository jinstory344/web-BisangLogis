"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { VehicleDispatchItem } from "@/lib/vehicle-list"

const FIRST_PAGE = 5
const MORE_PAGE = 20

function monthDay(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
}

/**
 * 차량 판의 "최근 배차": 목록 화면이 미리 받아 둔 것을 바로 보여 준다(판을 열 때 기다림 없음).
 * 5건 → 더 보기로 20건씩 → 그보다 많으면 검색 화면(달별 묶음)으로.
 */
export function VehicleDispatchHistory({
  plateNo,
  items,
  total,
}: {
  plateNo: string
  items: VehicleDispatchItem[]
  total: number
}) {
  const [shown, setShown] = useState(FIRST_PAGE)
  const visible = items.slice(0, shown)
  const canLoadMore = shown < items.length
  const searchHref = `/search?q=${encodeURIComponent(plateNo)}&tab=dispatch`

  return (
    <section className="flex flex-col">
      <p className="flex h-8 items-center gap-1.5 border-t pt-1 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">최근 배차</span>
        {total > 0 ? `${total}건` : null}
      </p>

      {items.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">아직 이 차량의 배차가 없어요.</p>
      ) : (
        <ul>
          {visible.map((d) => (
            <li
              key={d.id}
              className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] gap-2 border-t py-2 text-sm"
            >
              <span className="text-[13px] text-muted-foreground tabular-nums">
                {monthDay(d.dispatch_date)}
              </span>
              <span className="min-w-0">
                <span className="block truncate">
                  {d.origin} → {d.destination}
                </span>
                {d.client_name ? (
                  <span className="block truncate text-xs text-muted-foreground">{d.client_name}</span>
                ) : null}
              </span>
              <span className="tabular-nums">
                {d.freight_amount != null ? d.freight_amount.toLocaleString("ko-KR") : "-"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canLoadMore ? (
        <Button
          type="button"
          variant="outline"
          className="mt-2 h-10"
          onClick={() => setShown(shown + MORE_PAGE)}
        >
          더 보기
          <ChevronDown />
        </Button>
      ) : null}

      {total > FIRST_PAGE ? (
        <Button variant="secondary" className="mt-2 h-10" asChild>
          <Link href={searchHref}>
            검색에서 전체·월별로 보기
            <ChevronRight />
          </Link>
        </Button>
      ) : null}
    </section>
  )
}
