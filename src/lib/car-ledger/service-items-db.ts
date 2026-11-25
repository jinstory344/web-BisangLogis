import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

import type { CarServiceLine } from "./entries"

type Client = SupabaseClient<Database>

/** 정비 항목 줄이 붙는 부모: 지출(할부면 1회차 줄) 또는 차계부 기록 */
export type ServiceItemParent = { expenseId: string } | { carLogId: string }

function parentColumn(parent: ServiceItemParent): ["expense_id" | "car_log_id", string] {
  return "expenseId" in parent ? ["expense_id", parent.expenseId] : ["car_log_id", parent.carLogId]
}

/** 부모 하나의 정비 항목 줄 (순서대로) */
export async function loadServiceItems(supabase: Client, parent: ServiceItemParent): Promise<CarServiceLine[]> {
  const [column, id] = parentColumn(parent)
  const { data, error } = await supabase
    .from("car_service_items")
    .select("item, amount, sort_order")
    .eq(column, id)
    .order("sort_order")
  // 표를 못 읽어도(권한 등) 지출 화면은 그대로 열리게 빈 목록
  if (error || !data) return []
  return data.map((row) => ({ item: row.item, amount: row.amount === null ? null : Number(row.amount) }))
}

/**
 * 부모의 정비 항목 줄을 모두 지우고 다시 넣는다 (sort_order 0, 10, 20 …).
 * 감사 로그는 따로 남기지 않고 부모 기록의 로그 after_data에 줄 목록을 함께 넣는다.
 * 실패하면 오류 문장을 돌려준다.
 */
export async function replaceServiceItems(
  supabase: Client,
  parent: ServiceItemParent,
  items: readonly CarServiceLine[]
): Promise<string | null> {
  const [column, id] = parentColumn(parent)
  const { error: deleteError } = await supabase.from("car_service_items").delete().eq(column, id)
  if (deleteError) return deleteError.message
  if (items.length === 0) return null
  const { error } = await supabase.from("car_service_items").insert(
    items.map((line, index) => ({
      expense_id: column === "expense_id" ? id : null,
      car_log_id: column === "car_log_id" ? id : null,
      item: line.item.trim(),
      amount: line.amount,
      sort_order: index * 10,
    }))
  )
  return error ? error.message : null
}

/** 정비 항목 목록(car_items kind='service')의 이름들. 못 읽으면 빈 목록 */
export async function loadServiceItemNames(supabase: Client): Promise<string[]> {
  const { data, error } = await supabase
    .from("car_items")
    .select("name, sort_order")
    .eq("kind", "service")
    .is("deleted_at", null)
    .order("sort_order")
    .order("name")
  if (error || !data) return []
  return data.map((row) => row.name)
}

/**
 * 지출 줄들 → 그 정비 항목 이름들 (목록·장부의 비고 앞에 붙일 것).
 * 할부 회차 줄은 항목이 1회차에 붙어 있어 같은 묶음의 1회차 항목을 쓴다.
 * 차량 › 정비 줄이 없으면 아무것도 읽지 않는다.
 */
export async function loadServiceItemNamesForExpenses(
  supabase: Client,
  rows: readonly {
    id: string
    category_major: string
    category_minor: string
    installment_group_id: string | null
    installment_no: number | null
  }[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>()
  const serviceRows = rows.filter((row) => row.category_major === "차량" && row.category_minor === "정비")
  if (serviceRows.length === 0) return result

  // 1회차가 아닌 할부 줄은 같은 묶음의 1회차 id를 찾는다
  const groupIds = [
    ...new Set(
      serviceRows
        .filter((row) => row.installment_group_id && row.installment_no !== 1)
        .map((row) => row.installment_group_id as string)
    ),
  ]
  const firstOfGroup = new Map<string, string>()
  for (const row of serviceRows) {
    if (row.installment_group_id && row.installment_no === 1) firstOfGroup.set(row.installment_group_id, row.id)
  }
  const missingGroups = groupIds.filter((groupId) => !firstOfGroup.has(groupId))
  if (missingGroups.length > 0) {
    const { data } = await supabase
      .from("expenses")
      .select("id, installment_group_id")
      .in("installment_group_id", missingGroups)
      .eq("installment_no", 1)
      .is("deleted_at", null)
    for (const row of data ?? []) {
      if (row.installment_group_id) firstOfGroup.set(row.installment_group_id, row.id)
    }
  }

  const ownerOf = (row: (typeof serviceRows)[number]) =>
    row.installment_group_id ? (firstOfGroup.get(row.installment_group_id) ?? row.id) : row.id
  const ownerIds = [...new Set(serviceRows.map(ownerOf))]
  const { data, error } = await supabase
    .from("car_service_items")
    .select("expense_id, item, sort_order")
    .in("expense_id", ownerIds)
    .order("sort_order")
  if (error || !data) return result

  const namesByOwner = new Map<string, string[]>()
  for (const line of data) {
    if (!line.expense_id) continue
    const list = namesByOwner.get(line.expense_id) ?? []
    if (!list.includes(line.item)) list.push(line.item)
    namesByOwner.set(line.expense_id, list)
  }
  for (const row of serviceRows) {
    const names = namesByOwner.get(ownerOf(row))
    if (names) result.set(row.id, names)
  }
  return result
}
