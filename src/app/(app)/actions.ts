"use server"

import { redirect } from "next/navigation"

import {
  QUICK_SCAN_SIZE,
  toDispatchCandidate,
  toExpenseCandidate,
  toSaleCandidate,
  type CopyCandidate,
} from "@/lib/quick-entry"
import { createClient } from "@/lib/supabase/server"

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

/**
 * 모바일 빠른 등록 시트의 "최근 건 · 검색 · 자주 쓰는 건"에 쓸 후보 목록:
 * 매출·배차·지출 각각 최신 QUICK_SCAN_SIZE건(삭제 건 제외)을 합쳐 최신순으로 돌려준다.
 * 검색과 묶음(자주 쓰는 건) 계산은 기기에서 하므로 글자를 칠 때마다 서버를 부르지 않는다.
 * 개인정보(전화번호 등)는 조회하지 않는다 — 구간·거래처·출처·분류·차량번호·기사명·메모·금액만.
 * 시트를 열 때마다 지연 로드한다(방금 등록한 건도 바로 보이도록).
 */
export async function getCopyCandidatesAction(): Promise<CopyCandidate[]> {
  const supabase = await createClient()

  const [sales, dispatches, expenses] = await Promise.all([
    supabase
      .from("sales")
      .select(
        "id, created_at, sale_date, origin, destination, supply_amount, source_major, source_minor, source_note, billing_entity_name, memo"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(QUICK_SCAN_SIZE),
    supabase
      .from("dispatches")
      .select(
        "id, created_at, dispatch_date, origin, destination, freight_amount, client_id, contact_name, plate_no_snapshot, driver_name_snapshot, memo"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(QUICK_SCAN_SIZE),
    supabase
      .from("expenses")
      .select(
        "id, created_at, expense_date, category_major, category_minor, amount, payment_method, vendor, memo"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(QUICK_SCAN_SIZE),
  ])

  if (sales.error || dispatches.error || expenses.error) {
    const error = sales.error ?? dispatches.error ?? expenses.error
    throw new Error(`등록 건 조회 실패: ${error?.message}`)
  }

  // 배차는 거래처 이름으로도 검색할 수 있게 이름을 붙인다.
  const clientIds = Array.from(
    new Set(
      dispatches.data
        .map((row) => row.client_id)
        .filter((id): id is string => !!id)
    )
  )
  const clientNames = new Map<string, string>()
  if (clientIds.length > 0) {
    const { data: clients, error } = await supabase
      .from("clients")
      .select("id, name")
      .in("id", clientIds)
    if (error) throw new Error(`거래처 조회 실패: ${error.message}`)
    for (const client of clients) clientNames.set(client.id, client.name)
  }

  return [
    ...sales.data.map(toSaleCandidate),
    ...dispatches.data.map((row) =>
      toDispatchCandidate(
        row,
        row.client_id ? (clientNames.get(row.client_id) ?? null) : null
      )
    ),
    ...expenses.data.map(toExpenseCandidate),
  ].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  )
}
