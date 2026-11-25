import { ChevronDown } from "lucide-react"

import { formatKm } from "@/lib/car-ledger/constants"
import { formatKRW } from "@/lib/money"
import type { CarServiceHistoryRow } from "@/lib/supabase/database.types"

export type HistoryRow = Pick<
  CarServiceHistoryRow,
  "id" | "service_date" | "odometer_km" | "content" | "amount" | "vendor"
>

/** 정비 내역 여러 줄 → 한 줄 ("엔진오일 82,000 · 프론트 라이닝 88,000") */
function oneLine(content: string): string {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" · ")
}

function shortDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number)
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}(${weekday})`
}

/**
 * 11월 이전 정비 기록(엑셀에서 옮김): 연도별로 날짜 순서대로 한 줄씩.
 * 줄을 누르면 펼쳐져 전체 내역·km·정비소가 보인다. 보기 전용(지출과 이어지지 않음).
 */
export function HistoryTab({ rows }: { rows: readonly HistoryRow[] }) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">11월 이전 정비 기록이 없어요.</p>
  }

  const years = new Map<string, HistoryRow[]>()
  for (const row of rows) {
    const year = row.service_date.slice(0, 4)
    years.set(year, [...(years.get(year) ?? []), row])
  }
  const total = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        26년 11월 이전 · {rows.length}건 · 합계 {formatKRW(total)} — 줄을 누르면 자세히 보여요
      </p>
      {[...years].map(([year, list]) => (
        <section key={year} aria-label={`${year}년`} className="flex flex-col">
          <h3 className="flex items-baseline justify-between border-b pb-1 text-sm font-semibold">
            <span>{year}년</span>
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              {list.length}건 · {formatKRW(list.reduce((sum, row) => sum + (row.amount ?? 0), 0))}
            </span>
          </h3>
          <ul className="flex flex-col">
            {list.map((row) => (
              <li key={row.id} className="border-b last:border-b-0">
                <details className="group">
                  <summary className="grid cursor-pointer list-none grid-cols-[4.25rem_minmax(0,1fr)_auto] items-center gap-2 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
                    <span className="text-xs text-muted-foreground tabular-nums">{shortDate(row.service_date)}</span>
                    <span className="truncate">{oneLine(row.content)}</span>
                    <span className="flex items-center gap-1 font-semibold tabular-nums">
                      {row.amount === null ? "-" : row.amount.toLocaleString("ko-KR")}
                      <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <div className="mb-2.5 ml-[4.75rem] flex flex-col gap-1 rounded-md bg-muted/60 px-3 py-2 text-sm">
                    <p className="whitespace-pre-line">{row.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {[row.odometer_km !== null ? formatKm(row.odometer_km) : null, row.vendor]
                        .filter(Boolean)
                        .join(" · ") || "km·정비소 없음"}
                    </p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
