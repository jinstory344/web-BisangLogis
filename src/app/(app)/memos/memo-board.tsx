"use client"

import { ChevronDown, Plus, Search, Star } from "lucide-react"
import { useState } from "react"

import { ClientSheet } from "@/components/clients/client-sheet"
import { CopyMemoButton } from "@/components/memos/copy-memo-button"
import { MemoEditor, type MemoDraft } from "@/components/memos/memo-editor"
import { sortMemos } from "@/lib/memos"
import type { MemoKind } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

import type { MemoItem } from "./actions"

const normalize = (text: string) => text.replace(/\s/g, "").toLowerCase()

type Tab = "ALL" | MemoKind
const TABS: [Tab, string][] = [
  ["ALL", "전체"],
  ["DISPATCH", "배차메모"],
  ["WORK", "업무메모"],
]

/**
 * 메모 페이지 본문.
 * 위: [배차메모 | 업무메모] 탭 → "거래처 메모 N개 [거래처 ▾]"(거래처 선택판, 메모 수) → 찾기 칸.
 * 거래처를 고르면 그 거래처 메모 + 공통 메모, "전체"면 모든 메모. 고정(★) 먼저, 그다음 최근 순.
 * 카드를 누르면 고치기, 오른쪽 위 + 로 새 메모.
 */
export function MemoBoard({
  initialMemos,
  clientNames,
  initialKind,
  initialClientId,
}: {
  initialMemos: MemoItem[]
  clientNames: Record<string, string>
  initialKind: Tab
  initialClientId: string
}) {
  const [memos, setMemos] = useState(initialMemos)
  const [kind, setKind] = useState<Tab>(initialKind)
  const [clientId, setClientId] = useState(initialClientId)
  const [query, setQuery] = useState("")
  const [isClientOpen, setIsClientOpen] = useState(false)
  const [editor, setEditor] = useState<{ open: boolean; draft: MemoDraft }>({
    open: false,
    draft: { kind: initialKind === "ALL" ? "DISPATCH" : initialKind, client_id: null, title: "", body: "", pinned: false },
  })

  const ofKind = kind === "ALL" ? memos : memos.filter((m) => m.kind === kind)
  const counts: Record<string, number> = {}
  for (const m of ofKind) if (m.client_id) counts[m.client_id] = (counts[m.client_id] ?? 0) + 1

  const q = normalize(query)
  const shown = sortMemos(
    ofKind.filter(
      (m) =>
        (!clientId || m.client_id === clientId || m.client_id === null) &&
        (!q || normalize(m.title).includes(q) || normalize(m.body).includes(q))
    )
  )

  function openEditor(memo?: MemoItem) {
    setEditor({
      open: true,
      draft: memo
        ? { ...memo }
        : {
            kind: kind === "ALL" ? "DISPATCH" : kind,
            client_id: clientId || null,
            title: "",
            body: "",
            pinned: false,
          },
    })
  }

  function saved(memo: MemoItem) {
    setMemos((prev) => [memo, ...prev.filter((m) => m.id !== memo.id)])
    if (kind !== "ALL") setKind(memo.kind)
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">메모</h1>
        <button
          type="button"
          aria-label="새 메모"
          onClick={() => openEditor()}
          className="-mr-2 flex size-10 items-center justify-center rounded-full hover:bg-muted"
        >
          <Plus className="size-7" strokeWidth={1.75} />
        </button>
      </div>

      <nav className="mt-3 grid grid-cols-3 gap-1.5">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            onClick={() => setKind(value)}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1 rounded-full text-sm",
              kind === value ? "bg-foreground font-semibold text-background" : "bg-muted text-muted-foreground"
            )}
          >
            {label}
            <span className={kind === value ? "text-background/70" : "text-muted-foreground"}>
              {value === "ALL" ? memos.length : memos.filter((m) => m.kind === value).length}
            </span>
          </button>
        ))}
      </nav>

      <div className="mt-3 flex min-h-10 items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="min-w-0 truncate">
          <span className="font-semibold text-foreground">{clientId ? clientNames[clientId] ?? "거래처" : "전체"}</span>{" "}
          메모 {shown.length}개
        </span>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setIsClientOpen(true)}
          className={cn(
            "inline-flex h-9 max-w-44 shrink-0 items-center gap-1 rounded-full px-3.5 text-sm",
            clientId ? "bg-foreground font-semibold text-background" : "bg-muted text-foreground"
          )}
        >
          <span className="truncate">{clientId ? clientNames[clientId] ?? "거래처" : "거래처"}</span>
          <ChevronDown className="size-4 shrink-0" />
        </button>
      </div>

      <label className="mt-1 flex h-11 items-center gap-2 rounded-xl bg-muted px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목·내용으로 찾기"
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="mt-3 flex flex-col gap-2">
        {shown.map((memo) => (
          <div key={memo.id} className="flex items-start gap-2 rounded-xl bg-muted/60 py-3 pr-3 pl-3.5">
          <button
            type="button"
            onClick={() => openEditor(memo)}
            className="flex min-w-0 flex-1 flex-col gap-1 text-left"
          >
            <span className="flex items-center gap-1.5">
              {memo.pinned ? <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" /> : null}
              <span className="min-w-0 text-[15px] font-semibold break-keep wrap-anywhere">{memo.title}</span>
              {kind === "ALL" ? (
                <span className="shrink-0 rounded-full bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {memo.kind === "DISPATCH" ? "배차" : "업무"}
                </span>
              ) : null}
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px]",
                  memo.client_id ? "bg-background/60 text-muted-foreground" : "bg-emerald-900/50 text-emerald-300"
                )}
              >
                {memo.client_id ? clientNames[memo.client_id] ?? "거래처" : "공통"}
              </span>
            </span>
            {memo.body ? (
              <span className="line-clamp-2 text-[13px] leading-snug whitespace-pre-line text-muted-foreground">
                {memo.body}
              </span>
            ) : null}
          </button>
          <CopyMemoButton memo={memo} />
          </div>
        ))}

        {shown.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {q ? "찾는 메모가 없어요" : "아직 메모가 없어요"}
            <button
              type="button"
              onClick={() => openEditor()}
              className="mx-auto mt-3 flex h-10 items-center gap-1 rounded-full bg-muted px-4 text-foreground"
            >
              <Plus className="size-4" /> 새 메모
            </button>
          </div>
        ) : null}
      </div>

      <ClientSheet
        open={isClientOpen}
        onOpenChange={setIsClientOpen}
        title="거래처로 보기"
        selectedId={clientId}
        counts={counts}
        allCount={ofKind.length}
        countLabels={["메모 있음", "메모 없음"]}
        unit="개"
        onPick={(client) => setClientId(client?.id ?? "")}
      />

      <MemoEditor
        open={editor.open}
        onOpenChange={(open) => setEditor((prev) => ({ ...prev, open }))}
        draft={editor.draft}
        clientNames={clientNames}
        onSaved={saved}
        onDeleted={(id) => setMemos((prev) => prev.filter((m) => m.id !== id))}
      />
    </div>
  )
}
