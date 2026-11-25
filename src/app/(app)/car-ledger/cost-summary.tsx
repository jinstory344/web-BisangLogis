import { formatKRW } from "@/lib/money"
import { formatChangeRate, SUMMARY_TITLE_CLASS, type SummaryComparison } from "@/lib/summary"

/**
 * 차 비용: 큰 숫자 + 종류별 가로 막대 한 줄 + 범례(색 점 · 이름 · 금액).
 * 합계는 그 기간 날짜의 실제 줄 합(지출 목록과 같은 기준, 할부는 회차 금액).
 * 일일(탭) 화면은 "11월 차 비용" 작은 글자, 달력·월별·연별 보기의 집계 카드는 다른 화면 집계 카드처럼 큰 흰 글자 + 비교.
 */
export function CostSummary({
  monthLabel,
  total,
  byKind,
  variant = "tab",
  previous = null,
}: {
  /** "11월" / "2026년 11월" / "2026년" / "전체 기간" */
  monthLabel: string
  total: number
  byKind: { kind: string; total: number; color: string }[]
  /** tab: 일일(탭) 화면 머리 / card: 보기의 집계 카드 */
  variant?: "tab" | "card"
  /** 집계 카드의 비교 (지난 달 / 작년) */
  previous?: SummaryComparison | null
}) {
  const positive = byKind.filter((row) => row.total > 0)
  return (
    <section aria-label={`${monthLabel} 차 비용`} className="rounded-xl border bg-card p-4">
      <p className={variant === "card" ? SUMMARY_TITLE_CLASS : "text-xs text-muted-foreground"}>
        {monthLabel} 차 비용
      </p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums">{formatKRW(total)}</p>
      {previous ? (
        <p className="text-sm text-muted-foreground">
          {formatChangeRate(total, previous.total, "비용", previous.rateWord)} ({previous.label}{" "}
          {formatKRW(previous.total)})
        </p>
      ) : null}

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
