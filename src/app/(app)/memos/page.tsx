import { createClient } from "@/lib/supabase/server"

import { listMemosAction } from "./actions"
import { MemoBoard } from "./memo-board"

export const metadata = { title: "메모" }

/** 메모 페이지: [전체 | 배차메모 | 업무메모] 탭, 거래처로 보기, 찾기, ★고정, 쓰기·고치기 */
export default async function MemosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; client?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const [memos, clientsRes] = await Promise.all([
    listMemosAction(),
    supabase.from("clients").select("id, name").is("deleted_at", null),
  ])

  return (
    <MemoBoard
      initialMemos={memos}
      clientNames={Object.fromEntries((clientsRes.data ?? []).map((c) => [c.id, c.name]))}
      initialKind={params.tab === "work" ? "WORK" : params.tab === "dispatch" ? "DISPATCH" : "ALL"}
      initialClientId={params.client ?? ""}
    />
  )
}
