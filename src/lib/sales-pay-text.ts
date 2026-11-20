import { formatKRW } from "@/lib/money"
import type { SaleRow } from "@/lib/supabase/database.types"

/** "2026-11-20" → "11/20" */
export function shortMonthDay(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
}

/** 매출 한 건의 입금 창 제목·설명: "330,000원 입금 처리할까요?" / "피셔 → 칠곡경북대병원 · 우영로지스" */
export function salePayText(sale: Pick<SaleRow, "total_amount" | "origin" | "destination" | "source_minor">) {
  return {
    title: `${formatKRW(sale.total_amount)} 입금 처리할까요?`,
    caption: [`${sale.origin} → ${sale.destination}`, sale.source_minor].filter(Boolean).join(" · "),
  }
}


/** 그 달의 칸들: 앞쪽 빈칸(월요일 시작) + 1일~말일 "YYYY-MM-DD" */
export function monthCells(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number)
  const first = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return [
    ...Array<null>(first).fill(null),
    ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ]
}
