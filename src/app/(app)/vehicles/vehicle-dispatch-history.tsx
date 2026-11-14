"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useEffect, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"

import { getVehicleDispatchesAction, type VehicleDispatchItem } from "./actions"

const FIRST_PAGE = 5
const MORE_PAGE = 20
/** 판 안에서는 이만큼까지만 이어 보고, 그 뒤는 검색 화면에서 */
const MAX_IN_SHEET = 50

function monthDay(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
}

/** 차량 판의 "최근 배차": 5건 → 더 보기로 이어서 → 많으면 검색 화면(전체·월별)으로 */
export function VehicleDispatchHistory({
  vehicleId,
  plateNo,
}: {
  vehicleId: string
  plateNo: string
}) {
  const [items, setItems] = useState<VehicleDispatchItem[] | null>(null)
  const [total, setTotal] = useState(0)
  const [failed, setFailed] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let alive = true
    getVehicleDispatchesAction(vehicleId, 0, FIRST_PAGE).then(
      (result) => {
        if (!alive) return
        setItems(result.items)
        setTotal(result.total)
      },
      () => alive && setFailed(true)
    )
    return () => {
      alive = false
    }
  }, [vehicleId])

  function loadMore() {
    if (!items) return
    startTransition(async () => {
      try {
        const result = await getVehicleDispatchesAction(vehicleId, items.length, MORE_PAGE)
        setItems([...items, ...result.items])
        setTotal(result.total)
      } catch {
        setFailed(true)
      }
    })
  }

  const searchHref = `/search?q=${encodeURIComponent(plateNo)}&tab=dispatch`
  const shown = items?.length ?? 0
  const canLoadMore = shown < total && shown < MAX_IN_SHEET

  return (
    <section className="flex flex-col">
      <p className="flex h-8 items-center gap-1.5 border-t pt-1 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">최근 배차</span>
        {items ? `전체 ${total}건` : null}
      </p>

      {failed ? (
        <p className="py-3 text-sm text-destructive">배차 내역을 불러오지 못했어요.</p>
      ) : items === null ? (
        <div aria-hidden className="flex flex-col gap-2 py-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted/40" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">아직 이 차량의 배차가 없어요.</p>
      ) : (
        <ul>
          {items.map((d) => (
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

      {items && canLoadMore ? (
        <Button
          type="button"
          variant="outline"
          className="mt-2 h-10"
          disabled={isPending}
          onClick={loadMore}
        >
          {isPending ? "불러오는 중..." : "더 보기"}
          {isPending ? null : <ChevronDown />}
        </Button>
      ) : null}

      {items && total > FIRST_PAGE ? (
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
