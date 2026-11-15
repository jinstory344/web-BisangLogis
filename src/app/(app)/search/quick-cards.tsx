import { HandCoins, TrendingUp, Truck } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { EXPENSE_TEXT_CLASS, INCOME_TEXT_CLASS } from "@/components/ledger/colors"
import { getCurrentMonthRangeInSeoul } from "@/lib/date"
import { searchHref } from "@/lib/search"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

import { fetchAllRows } from "../ledger-data"

import { RecentSearches } from "./recent-searches"

function Card({
  href,
  icon,
  iconClassName,
  title,
  sub,
  amount,
  amountClassName,
  count,
}: {
  href: string
  icon: ReactNode
  iconClassName: string
  title: string
  sub: string
  amount: string
  amountClassName?: string
  count: string
}) {
  return (
    <Link href={href} prefetch className="flex items-center gap-3 rounded-xl bg-card px-3.5 py-3 active:bg-muted">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", iconClassName)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className={cn("block text-[15px] font-semibold tabular-nums", amountClassName)}>{amount}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">{count}</span>
      </span>
    </Link>
  )
}

/**
 * 검색 첫 화면(아무것도 안 쳤을 때): 이번 달 숫자가 보이는 빠른 조건 3개 + 최근에 찾은 조건.
 * 카드를 누르면 그 조건 칩이 채워진 결과로 바로 열린다.
 */
export async function QuickCards() {
  const month = getCurrentMonthRangeInSeoul()
  const supabase = await createClient()
  const [sales, dispatches] = await Promise.all([
    fetchAllRows((a, b) =>
      supabase
        .from("sales")
        .select("supply_amount, payment_status")
        .is("deleted_at", null)
        .gte("sale_date", month.from)
        .lte("sale_date", month.to)
        .order("id")
        .range(a, b)
    ),
    fetchAllRows((a, b) =>
      supabase
        .from("dispatches")
        .select("freight_amount")
        .is("deleted_at", null)
        .gte("dispatch_date", month.from)
        .lte("dispatch_date", month.to)
        .order("id")
        .range(a, b)
    ),
  ])
  const unpaid = sales.filter((s) => s.payment_status === "UNPAID")
  const won = (n: number) => n.toLocaleString("ko-KR")

  return (
    <div className="flex flex-col gap-5 pt-2">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">빠른 조건</p>
        <Card
          href={searchHref("", "sale", month, { unpaid: true })}
          icon={<HandCoins className="size-4" />}
          iconClassName="bg-red-400/15 text-red-300"
          title="이번 달 미입금"
          sub="매출"
          amount={won(unpaid.reduce((t, s) => t + s.supply_amount, 0))}
          amountClassName={EXPENSE_TEXT_CLASS}
          count={`${unpaid.length}건`}
        />
        <Card
          href={searchHref("", "sale", month)}
          icon={<TrendingUp className="size-4" />}
          iconClassName="bg-blue-400/15 text-blue-300"
          title="이번 달 매출"
          sub="매출 전체"
          amount={won(sales.reduce((t, s) => t + s.supply_amount, 0))}
          amountClassName={INCOME_TEXT_CLASS}
          count={`${sales.length}건`}
        />
        <Card
          href={searchHref("", "dispatch", month)}
          icon={<Truck className="size-4" />}
          iconClassName="bg-yellow-400/15 text-yellow-300"
          title="이번 달 배차"
          sub="배차 전체"
          amount={won(dispatches.reduce((t, d) => t + (d.freight_amount ?? 0), 0))}
          count={`${dispatches.length}건`}
        />
      </section>
      <RecentSearches />
    </div>
  )
}
