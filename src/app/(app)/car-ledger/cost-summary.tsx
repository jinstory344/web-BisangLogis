import { formatKRW } from "@/lib/money"

/**
 * 이달 차 비용: 큰 숫자 + 종류별 가로 막대 한 줄 + 범례(색 점 · 이름 · 금액).
 * 합계는 그 달 날짜의 실제 줄 합(지출 목록과 같은 기준, 할부는 회차 금액).
 */
export function CostSummary({
  monthLabel,
  total,
  byKind,
}: {
  /** "11월" */
  monthLabel: string
  total: number
  byKind: { kind: string; total: number; color: string }[]
}) {
  const positive = byKind.filter((row) => row.total > 0)
  return (
    <section aria-label={`${monthLabel} 차 비용`} className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{monthLabel} 차 비용</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums">{formatKRW(total)}</p>

      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        {total > 0
          ? positive.map((row) => (
              <span
                key={row.kind}
                className="h-full"
                style={{ width: `${(row.total / total) * 100}%`, backgroundColor: row.color }}
              />
            ))
          : null}
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-3">
        {byKind.map((row) => (
          <li key={row.kind} className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="truncate text-muted-foreground">{row.kind}</span>
            <span className="ml-auto shrink-0 font-medium tabular-nums">{formatKRW(row.total)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
