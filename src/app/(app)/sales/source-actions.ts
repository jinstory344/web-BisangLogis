"use server"

import { revalidatePath } from "next/cache"

import { recordAuditLog } from "@/lib/audit/log"
import {
  nextSortOrder,
  type DeleteCategoryInput,
  type NewCategoryInput,
  type RenameCategoryInput,
} from "@/lib/constants/expense-categories"
import {
  checkDeleteSaleSource,
  checkNewSaleSource,
  checkRenameSaleSource,
  type SaleSourceTree,
} from "@/lib/constants/sale-sources"
import { createClient } from "@/lib/supabase/server"

import { getSaleSources } from "./sources"

export type SourceActionResult =
  | { ok: true; tree: SaleSourceTree }
  | { ok: false; error: string }

function fail(error: string): SourceActionResult {
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

function parseRenameCategoryInput(input: unknown): RenameCategoryInput | null {
  if (typeof input !== "object" || input === null) return null
  const value = input as Record<string, unknown>
  if (typeof value.major !== "string" || typeof value.name !== "string") return null
  if (value.minor === undefined) return { major: value.major, name: value.name }
  if (typeof value.minor === "string") {
    return { major: value.major, minor: value.minor, name: value.name }
  }
  return null
}

/** 매출 출처 추가 (대분류 또는 하위분류). 새 항목은 같은 단계의 맨 뒤에 붙는다. */
export async function addSaleSourceAction(
  rawInput: NewCategoryInput
): Promise<SourceActionResult> {
  const input = parseNewCategoryInput(rawInput)
  if (!input) return fail("입력값이 올바르지 않아요")

  const { tree, editable } = await getSaleSources()
  if (!editable) return fail("출처를 저장할 수 없는 상태예요. 관리자에게 문의하세요")

  const check = checkNewSaleSource(tree, input)
  if (!check.ok) return fail(check.error)

  const supabase = await createClient()

  // 같은 단계의 정렬값을 보고 새 행을 맨 뒤(소분류는 "기타" 앞)에 둔다.
  let sortOrder: number
  if (input.kind === "major") {
    const { data: majors, error } = await supabase
      .from("sale_sources")
      .select("sort_order")
      .is("deleted_at", null)
      .is("sub", null)
    if (error) return fail(`출처 조회 실패: ${error.message}`)
    sortOrder = nextSortOrder((majors ?? []).map((row) => row.sort_order))
  } else {
    const { data: minors, error } = await supabase
      .from("sale_sources")
      .select("sort_order")
      .is("deleted_at", null)
      .eq("major", input.major)
      .not("sub", "is", null)
    if (error) return fail(`출처 조회 실패: ${error.message}`)
    sortOrder = nextSortOrder((minors ?? []).map((row) => row.sort_order))
  }

  const row: { major: string; sub: string | null; sort_order: number } =
    input.kind === "major"
      ? { major: check.name, sub: null, sort_order: sortOrder }
      : { major: input.major, sub: check.name, sort_order: sortOrder }

  const { data: inserted, error } = await supabase
    .from("sale_sources")
    .insert(row)
    .select("*")

  if (error) {
    // 동시에 같은 이름이 만들어진 경우 (유일 제약)
    if (error.code === "23505") return fail("이미 있는 출처예요")
    return fail(`출처 저장 실패: ${error.message}`)
  }

  for (const row of inserted ?? []) {
    await recordAuditLog(supabase, {
      tableName: "sale_sources",
      recordId: row.id,
      action: "CREATE",
      afterData: row,
    })
  }

  revalidatePath("/sales")
  revalidatePath("/new")
  const next = await getSaleSources()
  return { ok: true, tree: next.tree }
}

/**
 * 매출 출처 삭제(소프트 삭제). 대분류를 지우면 그 아래 하위분류도 함께 지운다.
 * 이미 등록한 매출에는 출처 이름이 글자로 남아 있어서 매출 내역은 그대로다.
 */
export async function deleteSaleSourceAction(
  rawInput: DeleteCategoryInput
): Promise<SourceActionResult> {
  const input = parseDeleteCategoryInput(rawInput)
  if (!input) return fail("입력값이 올바르지 않아요")

  const { tree, editable } = await getSaleSources()
  if (!editable) return fail("출처를 저장할 수 없는 상태예요. 관리자에게 문의하세요")

  const check = checkDeleteSaleSource(tree, input)
  if (!check.ok) return fail(check.error)

  const supabase = await createClient()

  let query = supabase
    .from("sale_sources")
    .select("*")
    .is("deleted_at", null)
    .eq("major", input.major)
  if (input.minor !== undefined) query = query.eq("sub", input.minor)

  const { data: targets, error: fetchError } = await query
  if (fetchError) return fail(`출처 조회 실패: ${fetchError.message}`)
  if (!targets || targets.length === 0) return fail("출처를 찾을 수 없어요")

  const { error } = await supabase
    .from("sale_sources")
    .update({ deleted_at: new Date().toISOString() })
    .in(
      "id",
      targets.map((row) => row.id)
    )
  if (error) return fail(`출처 삭제 실패: ${error.message}`)

  for (const row of targets) {
    await recordAuditLog(supabase, {
      tableName: "sale_sources",
      recordId: row.id,
      action: "DELETE",
      beforeData: row,
    })
  }

  revalidatePath("/sales")
  revalidatePath("/new")
  const next = await getSaleSources()
  return { ok: true, tree: next.tree }
}

/**
 * 매출 출처 이름 바꾸기. 출처 목록뿐 아니라 이미 등록한 매출(삭제한 것 포함)의 출처 이름도
 * 새 이름으로 바꾼다 — 목록·통계·검색에서 옛 이름과 새 이름이 따로 나뉘지 않게.
 * 대분류를 바꾸면 그 아래 하위분류 행과 그 대분류의 매출이 모두 새 대분류로 옮겨 간다.
 * 금액 열은 건드리지 않는다 (출처 글자만 바꾼다).
 */
export async function renameSaleSourceAction(
  rawInput: RenameCategoryInput
): Promise<SourceActionResult> {
  const input = parseRenameCategoryInput(rawInput)
  if (!input) return fail("입력값이 올바르지 않아요")

  const { tree, editable } = await getSaleSources()
  if (!editable) return fail("출처를 저장할 수 없는 상태예요. 관리자에게 문의하세요")

  const check = checkRenameSaleSource(tree, input)
  if (!check.ok) return fail(check.error)
  const newName = check.name
  const isMajor = input.minor === undefined

  const supabase = await createClient()

  // 1) 출처 목록
  let sourceQuery = supabase
    .from("sale_sources")
    .select("*")
    .is("deleted_at", null)
    .eq("major", input.major)
  if (!isMajor) sourceQuery = sourceQuery.eq("sub", input.minor as string)
  const { data: sourceRows, error: sourceFetchError } = await sourceQuery
  if (sourceFetchError) return fail(`출처 조회 실패: ${sourceFetchError.message}`)
  if (!sourceRows || sourceRows.length === 0) return fail("출처를 찾을 수 없어요")

  const { data: renamedSources, error: sourceError } = await supabase
    .from("sale_sources")
    .update(isMajor ? { major: newName } : { sub: newName })
    .in(
      "id",
      sourceRows.map((row) => row.id)
    )
    .select("*")
  if (sourceError) {
    if (sourceError.code === "23505") return fail("이미 있는 출처예요")
    return fail(`출처 이름 바꾸기 실패: ${sourceError.message}`)
  }

  // 2) 이미 등록한 매출
  let saleQuery = supabase.from("sales").select("*").eq("source_major", input.major)
  if (!isMajor) saleQuery = saleQuery.eq("source_sub", input.minor as string)
  const { data: saleRows, error: saleFetchError } = await saleQuery
  if (saleFetchError) {
    return fail(`출처 이름은 바꿨지만 매출 조회에 실패했어요: ${saleFetchError.message}`)
  }

  let renamedSales: typeof saleRows = []
  if (saleRows && saleRows.length > 0) {
    const { data, error } = await supabase
      .from("sales")
      .update(isMajor ? { source_major: newName } : { source_sub: newName })
      .in(
        "id",
        saleRows.map((row) => row.id)
      )
      .select("*")
    if (error) {
      return fail(`출처 이름은 바꿨지만 매출에 반영하지 못했어요: ${error.message}`)
    }
    renamedSales = data ?? []
  }

  // 3) 변경 이력
  const beforeSource = new Map(sourceRows.map((row) => [row.id, row]))
  const beforeSale = new Map((saleRows ?? []).map((row) => [row.id, row]))
  await Promise.all([
    ...(renamedSources ?? []).map((row) =>
      recordAuditLog(supabase, {
        tableName: "sale_sources",
        recordId: row.id,
        action: "UPDATE",
        beforeData: beforeSource.get(row.id) ?? null,
        afterData: row,
      })
    ),
    ...renamedSales.map((row) =>
      recordAuditLog(supabase, {
        tableName: "sales",
        recordId: row.id,
        action: "UPDATE",
        beforeData: beforeSale.get(row.id) ?? null,
        afterData: row,
      })
    ),
  ])

  // 홈(장부)·검색·매출 목록에 출처가 보이므로 전체를 새로 그린다.
  revalidatePath("/", "layout")
  const next = await getSaleSources()
  return { ok: true, tree: next.tree }
}
