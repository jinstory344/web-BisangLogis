import * as XLSX from "xlsx"

import { fetchAllRows } from "@/app/(app)/ledger-data"
import {
  clientsTable,
  dispatchesTable,
  EXPORT_KINDS,
  expensesTable,
  exportFileName,
  salesTable,
  vehiclesTable,
  type ExportKind,
  type Table,
} from "@/lib/excel-export"
import { createClient } from "@/lib/supabase/server"
import type { ClientRow, DispatchRow, ExpenseRow, SaleRow, VehicleRow } from "@/lib/supabase/database.types"

export const dynamic = "force-dynamic"

const DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * 엑셀 내보내기: /api/export?kinds=sale,expense,dispatch,client,vehicle&from=2026-11-01&to=2026-11-30
 * 종류마다 시트 하나. 매출·지출·배차는 기간 안만(from·to 없으면 전체), 거래처·차량은 늘 전부.
 * 로그인한 사람만(미들웨어 + 여기서 한 번 더). 지운 것(휴지통)은 넣지 않는다.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  // 개발 서버는 로그인 없이 관리자 연결을 쓰므로(server.ts) 이 확인을 건너뛴다. 배포에서는 늘 확인.
  if (process.env.NODE_ENV !== "development" && !auth?.claims) {
    return new Response("로그인이 필요해요", { status: 401 })
  }

  const url = new URL(request.url)
  const valid = new Set(EXPORT_KINDS.map((k) => k.value))
  const kinds = (url.searchParams.get("kinds") ?? "")
    .split(",")
    .filter((k): k is ExportKind => valid.has(k as ExportKind))
  if (kinds.length === 0) return new Response("내보낼 종류를 골라 주세요", { status: 400 })
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")
  const period = from && to && DATE.test(from) && DATE.test(to) ? { from, to } : null

  // 기간 거르기 + 1000행씩 끝까지
  const dated = <T,>(table: "sales" | "expenses" | "dispatches", dateCol: string) =>
    fetchAllRows<T>((a, b) => {
      let q = supabase.from(table).select("*").is("deleted_at", null)
      if (period) q = q.gte(dateCol, period.from).lte(dateCol, period.to)
      return q.order(dateCol).order("id").range(a, b) as unknown as PromiseLike<{ data: T[] | null; error: { message: string } | null }>
    })

  const sheets: { name: string; table: Table }[] = []
  try {
    for (const kind of EXPORT_KINDS.map((k) => k.value).filter((k) => kinds.includes(k))) {
      if (kind === "sale") {
        sheets.push({ name: "매출", table: salesTable(await dated<SaleRow>("sales", "sale_date")) })
      } else if (kind === "expense") {
        sheets.push({ name: "지출", table: expensesTable(await dated<ExpenseRow>("expenses", "expense_date")) })
      } else if (kind === "dispatch") {
        const [rows, clients] = await Promise.all([
          dated<DispatchRow>("dispatches", "dispatch_date"),
          supabase.from("clients").select("id, name"),
        ])
        const names = new Map((clients.data ?? []).map((c) => [c.id, c.name]))
        sheets.push({ name: "배차", table: dispatchesTable(rows, names) })
      } else if (kind === "client") {
        const [clients, contacts] = await Promise.all([
          supabase.from("clients").select("*").is("deleted_at", null).order("name"),
          supabase.from("client_contacts").select("client_id, name, phone, sort_order").is("deleted_at", null).order("sort_order"),
        ])
        const byClient = new Map<string, { name: string; phone: string | null }[]>()
        for (const c of contacts.data ?? []) {
          byClient.set(c.client_id, [...(byClient.get(c.client_id) ?? []), { name: c.name, phone: c.phone }])
        }
        sheets.push({ name: "거래처", table: clientsTable((clients.data ?? []) as ClientRow[], byClient) })
      } else if (kind === "vehicle") {
        const { data } = await supabase.from("vehicles").select("*").is("deleted_at", null).order("driver_name")
        sheets.push({ name: "차량", table: vehiclesTable((data ?? []) as VehicleRow[]) })
      }
    }
  } catch (error) {
    console.error("export failed", error)
    return new Response("내보내기 실패", { status: 500 })
  }

  const book = XLSX.utils.book_new()
  for (const { name, table } of sheets) {
    const sheet = XLSX.utils.aoa_to_sheet(table)
    // 칸 너비: 머리줄·내용 중 긴 쪽(한글은 두 칸으로 셈)
    sheet["!cols"] = table[0].map((_, col) => ({
      wch: Math.min(
        40,
        Math.max(...table.slice(0, 200).map((row) => String(row[col] ?? "").replace(/[^\x00-\xff]/g, "xx").length)) + 2
      ),
    }))
    XLSX.utils.book_append_sheet(book, sheet, name)
  }
  const buffer: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" })
  const fileName = exportFileName(period?.from ?? null, period?.to ?? null)

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  })
}
