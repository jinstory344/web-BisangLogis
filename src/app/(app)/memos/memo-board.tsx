"use client"

import { ChevronDown, ChevronUp, Plus, Search, Star } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ClientSheet } from "@/components/clients/client-sheet"
import { CopyMemoButton } from "@/components/memos/copy-memo-button"
import { MemoEditor, type MemoDraft } from "@/components/memos/memo-editor"
import { memoSwapNeighbor, sortMemos } from "@/lib/memos"
import type { MemoKind } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

import { swapMemoOrderAction, type MemoItem } from "./actions"

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
  // 순서 바꾸기: 보이는 목록(전체 또는 고른 거래처)에서 한 칸씩 위·아래로 옮긴다
  const [isReordering, setIsReordering] = useState(false)
  const [movingId, setMovingId] = useState<string | null>(null)
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

  async function move(memo: MemoItem, dir: -1 | 1) {
    const neighbor = memoSwapNeighbor(shown, memo.id, dir)
    if (!neighbor || movingId) return
    setMovingId(memo.id)
    // 화면 먼저 바꾸고, 서버 결과로 맞춘다
    setMemos((prev) =>
      prev.map((m) =>
        m.id === memo.id
          ? { ...m, sort_order: neighbor.sort_order }
          : m.id === neighbor.id
            ? { ...m, sort_order: memo.sort_order }
            : m
      )
    )
    const result = await swapMemoOrderAction(memo.id, neighbor.id)
    setMovingId(null)
    if (!result.ok) {
      toast.error(result.error)
      setMemos((prev) =>
        prev.map((m) => (m.id === memo.id ? memo : m.id === neighbor.id ? neighbor : m))
      )
      return
    }
    setMemos((prev) => prev.map((m) => result.memos.find((u) => u.id === m.id) ?? m))
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
              kind !== value
                ? "bg-muted text-muted-foreground"
                : value === "DISPATCH"
                  ? "bg-[#34507d] font-semibold text-[#e3ecfb]"
                  : value === "WORK"
                    ? "bg-[#355a43] font-semibold text-[#e0f4e7]"
                    : "bg-foreground font-semibold text-background"
            )}
          >
            {label}
            <span className="opacity-70">
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
        <span className="flex shrink-0 items-center gap-1.5">
        {shown.length > 1 ? (
          <button
            type="button"
            aria-pressed={isReordering}
            onClick={() => setIsReordering((v) => !v)}
            className={cn(
              "h-9 rounded-full px-3 text-sm",
              isReordering ? "bg-red-400/90 font-semibold text-white" : "text-muted-foreground underline underline-offset-4"
            )}
          >
            {isReordering ? "완료" : "순서 바꾸기"}
          </button>
        ) : null}
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
        </span>
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
          <div
            key={memo.id}
            className={cn(
              "flex items-start gap-2 rounded-xl border-l-4 py-3 pr-3 pl-3",
              // 배차 = 파랑, 업무 = 초록 — 카드 바탕까지 은은하게 (눈이 덜 피로한 어두운 톤)
              memo.kind === "DISPATCH" ? "border-l-[#5b7fb8] bg-[#252f40]" : "border-l-[#5a9a72] bg-[#25352c]"
            )}
          >
          <button
            type="button"
            disabled={isReordering}
            onClick={() => openEditor(memo)}
            className="flex min-w-0 flex-1 flex-col gap-1 text-left"
          >
            <span className="flex items-center gap-1.5">
              {memo.pinned ? <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" /> : null}
              <span className="min-w-0 text-[15px] font-semibold break-keep wrap-anywhere">{memo.title}</span>
            </span>
            <span className="flex flex-wrap items-center gap-1">
              {kind === "ALL" ? (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    memo.kind === "DISPATCH" ? "bg-[#34507d] text-[#d3e1f7]" : "bg-[#355a43] text-[#d0eedb]"
                  )}
                >
                  {memo.kind === "DISPATCH" ? "배차" : "업무"}
                </span>
              ) : null}
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px]",
                  memo.client_id ? "bg-background/60 text-muted-foreground" : "border border-foreground/20 text-foreground/80"
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
          {isReordering ? (
            <span className="flex shrink-0 gap-1">
              {([-1, 1] as const).map((dir) => {
                const canMove = memoSwapNeighbor(shown, memo.id, dir) !== null
                return (
                  <button
                    key={dir}
                    type="button"
                    aria-label={dir < 0 ? "위로" : "아래로"}
                    disabled={!canMove || movingId !== null}
                    onClick={() => move(memo, dir)}
                    className="flex size-10 items-center justify-center rounded-full bg-background/60 disabled:opacity-30"
                  >
                    {dir < 0 ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
                  </button>
                )
              })}
            </span>
          ) : (
            <CopyMemoButton memo={memo} />
          )}
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
