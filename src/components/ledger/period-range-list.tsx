import Link from "next/link"

import { cn } from "@/lib/utils"

export interface PeriodRangeItem {
  key: string
  /** "2주차 11/8~11/14" / "11월" / "2026년" */
  label: string
  /** 이름 옆 작은 글자 (예: "12건") */
  countText: string
  /** 오른쪽 큰 금액 */
  value: string
  valueClassName?: string
  /** 아래 작은 줄 (예: 매출 파랑 · 지출 빨강) */
  details?: { text: string; className?: string }[]
  /** 기록이 없는 기간 — 흐리게 */
  isEmpty: boolean
  /** 있으면 줄을 누르면 그 기간으로 */
  href?: string
}

/**
 * 주별·월별·연별 장부의 줄 목록: 기간마다 한 줄 — 이름, 건수, 금액, 아래 작은 줄.
 * 상자 없이 화면 폭을 꽉 채우고, 기록이 없는 기간은 흐리게 보여서 어느 달·해가 비었는지 알 수 있다.
 * HOME(누를 곳 없음)과 매출·지출·배차·차계부(누르면 그 기간 목록)가 함께 쓴다.
 */
export function PeriodRangeList({ items }: { items: PeriodRangeItem[] }) {
  return (
    <div className="-mx-4 divide-y border-b">
      {items.map((item) => {
        const className = cn("block px-4 py-2.5", item.isEmpty && "text-muted-foreground")
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">
                {item.label}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">{item.countText}</span>
              </span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  item.isEmpty ? "text-muted-foreground" : item.valueClassName
                )}
              >
                {item.value}
              </span>
            </div>
            {item.isEmpty || !item.details?.length ? null : (
              <div className="mt-1 flex gap-4 text-xs tabular-nums">
                {item.details.map((detail, index) => (
                  <span key={index} className={detail.className}>
                    {detail.text}
                  </span>
                ))}
              </div>
            )}
          </>
        )
        return item.href ? (
          <Link key={item.key} href={item.href} prefetch={false} className={cn(className, "active:bg-muted md:hover:bg-muted/50")}>
            {body}
          </Link>
        ) : (
          <div key={item.key} className={className}>
            {body}
          </div>
        )
      })}
    </div>
  )
}
