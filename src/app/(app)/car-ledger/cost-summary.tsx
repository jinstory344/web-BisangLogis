import type { ReactNode } from "react"

import { MonthBadge } from "@/components/list/month-badge"
import { formatKRW } from "@/lib/money"
import { formatChangeRate, type SummaryComparison } from "@/lib/summary"

/**
 * 차 비용: 큰 숫자 + 종류별 가로 막대 한 줄 + 범례(색 점 · 이름 · 금액).
 * 합계는 그 기간 날짜의 실제 줄 합(지출 목록과 같은 기준, 할부는 회차 금액).
 * "11월 차 비용" 제목은 다른 집계 카드처럼 조금 큰 흰 글자(사용자 요청: 잘 안 보임).
 */
export function CostSummary({
  monthLabel,
  total,
  byKind,
  previous = null,
  carLabel,
  action,
}: {
  /** 박스 맨 위 차 이름 · 번호판 (예: "포터2 · 서울86바7754") */
  carLabel?: string
  /** 박스 오른쪽 위 버튼 (설정 ⚙) */
  action?: ReactNode
  /** "11월" / "2026년 11월" / "2026년" / "전체 기간" */
  monthLabel: string
  total: number
  byKind: { kind: string; total: number; color: string }[]
  /** 집계 카드의 비교 (지난 달 / 작년) */
  previous?: SummaryComparison | null
}) {
  const positive = byKind.filter((row) => row.total > 0)
  return (
    <section aria-label={`${monthLabel} 차 비용`} className="rounded-xl border bg-card px-4 py-3">
      {carLabel || action ? (
        <div className="-mt-1.5 -mr-1.5 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{carLabel}</p>
          {action}
        </div>
      ) : null}
      {/* HOME처럼 동그란 달 배지(차계부 청록) ↔ 금액 맨 오른쪽 */}
      <div className="mt-1 flex items-center justify-between gap-3">
        <MonthBadge label={monthLabel} className="mr-0 h-7 bg-[#2a95a5] px-3 text-sm text-white" />
        <p className="text-2xl font-bold tracking-tight tabular-nums">{formatKRW(total)}</p>
      </div>
      {previous ? (
        <p className="text-sm text-muted-foreground">
          {formatChangeRate(total, previous.total, "비용", previous.rateWord)} ({previous.label}{" "}
          {formatKRW(previous.total)})
        </p>
      ) : null}

      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
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

      {/* 종류 범례는 한 줄 (위 고정 부분이 짧아지게) — 칸이 좁아 "원" 없이 숫자만 */}
      <ul className="mt-2 flex gap-3 text-[12px]">
        {byKind.map((row) => (
          <li key={row.kind} className="flex min-w-0 flex-1 items-center gap-1">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="shrink-0 text-muted-foreground">{row.kind}</span>
            <span className="ml-auto truncate font-medium tabular-nums">{row.total.toLocaleString("ko-KR")}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
