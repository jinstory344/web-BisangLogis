"use server"

import { revalidatePath } from "next/cache"

import { recordAuditLog } from "@/lib/audit/log"
import {
  checkDeleteCategory,
  checkNewCategory,
  CUSTOM_MINOR,
  CUSTOM_MINOR_SORT_ORDER,
  nextSortOrder,
  type DeleteCategoryInput,
  type ExpenseCategoryTree,
  type NewCategoryInput,
} from "@/lib/constants/expense-categories"
import { createClient } from "@/lib/supabase/server"

import { getExpenseCategories } from "./categories"

export type CategoryActionResult =
  | { ok: true; tree: ExpenseCategoryTree }
  | { ok: false; error: string }

function fail(error: string): CategoryActionResult {
  return { ok: false, error }
}

/** 클라이언트에서 온 값이라 모양을 직접 확인한다. */
function parseNewCategoryInput(input: unknown): NewCategoryInput | null {
  if (typeof input !== "object" || input === null) return null
  const value = input as Record<string, unknown>
  if (typeof value.name !== "string") return null
  if (value.kind === "major") return { kind: "major", name: value.name }
  if (value.kind === "minor" && typeof value.major === "string") {
    return { kind: "minor", major: value.major, name: value.name }
  }
  return null
}

function parseDeleteCategoryInput(input: unknown): DeleteCategoryInput | null {
  if (typeof input !== "object" || input === null) return null
  const value = input as Record<string, unknown>
  if (typeof value.major !== "string") return null
  if (value.minor === undefined) return { major: value.major }
  if (typeof value.minor === "string") {
    return { major: value.major, minor: value.minor }
  }
  return null
}

/**
 * 지출 분류 추가. 대분류를 추가하면 소분류 "기타"도 함께 만든다(직접 입력용).
 * 소분류는 "기타" 바로 앞에 붙는다.
 */
export async function addExpenseCategoryAction(
  rawInput: NewCategoryInput
): Promise<CategoryActionResult> {
  const input = parseNewCategoryInput(rawInput)
  if (!input) return fail("입력값이 올바르지 않아요")

  const { tree, editable } = await getExpenseCategories()
  if (!editable) return fail("분류를 저장할 수 없는 상태예요. 관리자에게 문의하세요")

  const check = checkNewCategory(tree, input)
  if (!check.ok) return fail(check.error)

  const supabase = await createClient()

  // 같은 단계의 정렬값을 보고 새 행을 맨 뒤(소분류는 "기타" 앞)에 둔다.
  let sortOrder: number
  if (input.kind === "major") {
    const { data: majors, error } = await supabase
      .from("expense_categories")
      .select("sort_order")
      .is("deleted_at", null)
      .is("minor", null)
    if (error) return fail(`분류 조회 실패: ${error.message}`)
    sortOrder = nextSortOrder((majors ?? []).map((row) => row.sort_order))
  } else {
    const { data: minors, error } = await supabase
      .from("expense_categories")
      .select("sort_order")
      .is("deleted_at", null)
      .eq("major", input.major)
      .not("minor", "is", null)
    if (error) return fail(`분류 조회 실패: ${error.message}`)
    sortOrder = nextSortOrder((minors ?? []).map((row) => row.sort_order))
  }

  const rows =
    input.kind === "major"
      ? [
          { major: check.name, minor: null, sort_order: sortOrder },
          {
            major: check.name,
            minor: CUSTOM_MINOR,
            sort_order: CUSTOM_MINOR_SORT_ORDER,
          },
        ]
      : [{ major: input.major, minor: check.name, sort_order: sortOrder }]

  const { data: inserted, error } = await supabase
    .from("expense_categories")
    .insert(rows)
    .select("*")

  if (error) {
    // 동시에 같은 이름이 만들어진 경우 (유일 제약)
    if (error.code === "23505") return fail("이미 있는 분류예요")
    return fail(`분류 저장 실패: ${error.message}`)
  }

  for (const row of inserted ?? []) {
    await recordAuditLog(supabase, {
      tableName: "expense_categories",
      recordId: row.id,
      action: "CREATE",
      afterData: row,
    })
  }

  revalidatePath("/expenses")
  const next = await getExpenseCategories()
  return { ok: true, tree: next.tree }
}

/**
 * 지출 분류 삭제(소프트 삭제). 대분류를 지우면 그 아래 소분류도 함께 지운다.
 * 이미 등록한 지출에는 분류 이름이 글자로 남아 있어서 지출 내역은 그대로다.
 */
export async function deleteExpenseCategoryAction(
  rawInput: DeleteCategoryInput
): Promise<CategoryActionResult> {
  const input = parseDeleteCategoryInput(rawInput)
  if (!input) return fail("입력값이 올바르지 않아요")

  const { tree, editable } = await getExpenseCategories()
  if (!editable) return fail("분류를 저장할 수 없는 상태예요. 관리자에게 문의하세요")

  const check = checkDeleteCategory(tree, input)
  if (!check.ok) return fail(check.error)

  const supabase = await createClient()

  let query = supabase
    .from("expense_categories")
    .select("*")
    .is("deleted_at", null)
    .eq("major", input.major)
  if (input.minor !== undefined) query = query.eq("minor", input.minor)

  const { data: targets, error: fetchError } = await query
  if (fetchError) return fail(`분류 조회 실패: ${fetchError.message}`)
  if (!targets || targets.length === 0) return fail("분류를 찾을 수 없어요")

  const { error } = await supabase
    .from("expense_categories")
    .update({ deleted_at: new Date().toISOString() })
    .in(
      "id",
      targets.map((row) => row.id)
    )
  if (error) return fail(`분류 삭제 실패: ${error.message}`)

  for (const row of targets) {
    await recordAuditLog(supabase, {
      tableName: "expense_categories",
      recordId: row.id,
      action: "DELETE",
      beforeData: row,
    })
  }

  revalidatePath("/expenses")
  const next = await getExpenseCategories()
  return { ok: true, tree: next.tree }
}
