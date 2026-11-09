"use server"

import { redirect } from "next/navigation"

import {
  mergeRecentCopyEntries,
  RECENT_COPY_LIMIT,
  toDispatchCopyEntry,
  toExpenseCopyEntry,
  toSaleCopyEntry,
  type RecentCopyEntry,
} from "@/lib/quick-entry"
import { createClient } from "@/lib/supabase/server"

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

/**
 * 모바일 빠른 등록 시트의 "최근 건 복사": 매출·배차·지출을 통틀어 created_at 최신 5건.
 * 삭제된 건은 제외하고, 개인정보(전화번호 등)는 조회하지 않는다 — 종류·날짜·구간/분류·금액만.
 * 시트를 열 때마다 지연 로드한다.
 */
export async function getRecentCopyEntriesAction(): Promise<RecentCopyEntry[]> {
  const supabase = await createClient()

  const [sales, dispatches, expenses] = await Promise.all([
    supabase
      .from("sales")
      .select("id, created_at, sale_date, origin, destination, supply_amount")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(RECENT_COPY_LIMIT),
    supabase
      .from("dispatches")
      .select(
        "id, created_at, dispatch_date, origin, destination, freight_amount"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(RECENT_COPY_LIMIT),
    supabase
      .from("expenses")
      .select(
        "id, created_at, expense_date, category_major, category_minor, amount"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(RECENT_COPY_LIMIT),
  ])

  if (sales.error || dispatches.error || expenses.error) {
    const error = sales.error ?? dispatches.error ?? expenses.error
    throw new Error(`최근 등록 건 조회 실패: ${error?.message}`)
  }

  return mergeRecentCopyEntries(
    [
      sales.data.map(toSaleCopyEntry),
      dispatches.data.map(toDispatchCopyEntry),
      expenses.data.map(toExpenseCopyEntry),
    ],
    RECENT_COPY_LIMIT
  )
}
