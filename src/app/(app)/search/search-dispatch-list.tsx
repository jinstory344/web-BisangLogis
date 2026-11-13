import Link from "next/link"

import { DayHeader } from "@/components/list/day-header"
import { groupByDay, spansMultipleMonths } from "@/lib/day-groups"
import { formatKRW } from "@/lib/money"

import type { SearchDispatch } from "./search-data"

/** "12가3456 · 김기사" (차량을 아직 정하지 않았으면 "차량 미정") */
function vehicleLine(dispatch: SearchDispatch): string {
  const text = [dispatch.plate_no_snapshot, dispatch.driver_name_snapshot]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ")
  return text || "차량 미정"
}

/** 검색으로 찾은 배차: 날짜별 묶음 + 두 줄 행. 누르면 배차 상세로 간다. */
export function SearchDispatchList({
  dispatches,
  clientNameMap,
  emptyMessage,
}: {
  dispatches: SearchDispatch[]
  clientNameMap: Record<string, string>
  emptyMessage: string
}) {
  if (dispatches.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    )
  }

  const groups = groupByDay(
    dispatches,
    (dispatch) => dispatch.dispatch_date,
    (dispatch) => dispatch.freight_amount ?? 0
  )
  const spansMonths = spansMultipleMonths(groups)

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <section key={group.date} className="overflow-hidden rounded-xl border">
          <DayHeader
            date={group.date}
            showMonth={spansMonths}
            totalLabel={`${group.rows.length}건${
              group.total > 0 ? ` · 운임 ${formatKRW(group.total)}` : ""
            }`}
          />
          {group.rows.map((dispatch) => (
            <Link
              key={dispatch.id}
              href={`/dispatches/${dispatch.id}`}
              prefetch
              className="flex items-start gap-3 border-t px-4 py-2.5 transition-colors first:border-t-0 hover:bg-muted/40 active:bg-muted/60"
            >
              <div className="w-16 shrink-0 truncate pt-0.5 text-xs leading-snug text-muted-foreground">
                {dispatch.client_id ? (clientNameMap[dispatch.client_id] ?? "-") : "-"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug font-medium break-keep wrap-anywhere">
                  {dispatch.origin} → {dispatch.destination}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  배차 · {vehicleLine(dispatch)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                {dispatch.freight_amount != null ? (
                  <span className="text-sm font-semibold tabular-nums">
                    {formatKRW(dispatch.freight_amount)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
                {dispatch.fee_amount > 0 ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    수수료 {formatKRW(dispatch.fee_amount)}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </section>
      ))}
    </div>
  )
}
