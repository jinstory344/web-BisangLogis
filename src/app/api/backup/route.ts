import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { expensesToSheet, salesToSheet } from "@/lib/backup-sheet"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ExpenseRow, SaleRow } from "@/lib/supabase/database.types"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 1000 // Supabase가 한 번에 주는 최대 줄 수

function isAuthorized(request: Request): boolean {
  const expected = process.env.BACKUP_TOKEN
  if (!expected) return false
  const given = request.headers.get("authorization") ?? ""
  const a = Buffer.from(given)
  const b = Buffer.from(`Bearer ${expected}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function fetchAll<T>(
  table: "sales" | "expenses",
  dateColumn: string
): Promise<T[]> {
  const supabase = createAdminClient()
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .is("deleted_at", null)
      .order(dateColumn, { ascending: false })
      .order("id")
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data as T[]))
    if (data.length < PAGE_SIZE) return rows
  }
}

/** 구글 시트 주간 백업용: 매출·지출 전체를 시트에 그대로 붙일 표로 돌려준다(읽기 전용). */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  try {
    const [sales, expenses] = await Promise.all([
      fetchAll<SaleRow>("sales", "sale_date"),
      fetchAll<ExpenseRow>("expenses", "expense_date"),
    ])
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      sales: salesToSheet(sales),
      expenses: expensesToSheet(expenses),
    })
  } catch (error) {
    console.error("backup failed", error)
    return NextResponse.json({ error: "backup failed" }, { status: 500 })
  }
}
