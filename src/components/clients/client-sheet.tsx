"use client"

import { Plus, Search, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  listClientsAction,
  quickCreateClientAction,
  type ClientSearchResult,
  type ListedClient,
} from "@/app/(app)/clients/actions"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatBizNo } from "@/lib/biz-no"
import type { ClientCategory } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

/** 띄어쓰기·대소문자·사업자번호의 "-"를 무시하고 비교 */
const normalize = (text: string) => text.replace(/[\s-]/g, "").toLowerCase()

interface Section {
  title: string | null
  clients: ListedClient[]
  muted?: boolean
}

/**
 * 아래에서 올라오는 거래처 선택판 — 배차 폼·매출 폼·배차 목록이 같이 쓴다.
 * 위에 찾기 칸, 고정한 거래처(★) 먼저, 줄은 엄지로 누르기 좋게 크게.
 * - counts가 있으면(목록 거래처별 보기): 맨 위 "전체", 건수 있는 거래처(많은 순) / 없는 거래처로 나눈다. 직접 입력 없음.
 * - 아니면 타 거래처가 있을 때 "내 거래처 / 타 거래처"로 나눈다.
 * - createCategory가 있으면 맨 아래 "직접 입력" — 누르면 그 구분으로 거래처를 만들고 바로 고른다.
 */
export function ClientSheet({
  open,
  onOpenChange,
  title = "거래처 선택",
  selectedId,
  onPick,
  createCategory,
  counts,
  allCount,
  countLabels = ["이 기간에 배차 있음", "배차 없음"],
  unit = "건",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  selectedId: string
  /** 거래처를 고르면 그 거래처, "전체"를 고르면 null */
  onPick: (client: ClientSearchResult | null) => void
  createCategory?: ClientCategory
  counts?: Record<string, number>
  allCount?: number
  /** counts가 있을 때 두 묶음 이름 */
  countLabels?: [string, string]
  /** 건수 뒤 단위 ("건", "개") */
  unit?: string
}) {
  const [clients, setClients] = useState<ListedClient[]>([])
  const [query, setQuery] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listClientsAction()
      .then(setClients)
      .catch(() => setClients([]))
  }, [])

  // 판을 열 때마다 찾기 칸을 비운다
  useEffect(() => {
    if (open) setQuery("")
  }, [open])

  const trimmed = query.trim()
  const q = normalize(trimmed)
  const shown = q
    ? clients.filter((c) => normalize(c.name).includes(q) || (c.biz_no ?? "").includes(q))
    : clients
  const canCreate =
    createCategory !== undefined && trimmed !== "" && !clients.some((c) => c.name === trimmed)

  let sections: Section[]
  if (counts) {
    const used = shown
      .filter((c) => (counts[c.id] ?? 0) > 0)
      .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
    const unused = shown.filter((c) => !(counts[c.id] ?? 0))
    sections = [
      { title: countLabels[0], clients: used },
      { title: countLabels[1], clients: unused, muted: true },
    ]
  } else if (clients.some((c) => c.category === "OTHER")) {
    sections = [
      { title: "내 거래처", clients: shown.filter((c) => c.category !== "OTHER") },
      { title: "타 거래처", clients: shown.filter((c) => c.category === "OTHER") },
    ]
  } else {
    sections = [{ title: null, clients: shown }]
  }

  function pick(client: ClientSearchResult | null) {
    onPick(client)
    onOpenChange(false)
  }

  async function create() {
    setIsCreating(true)
    try {
      const created = await quickCreateClientAction(trimmed, createCategory)
      setClients((prev) =>
        prev.some((c) => c.id === created.id)
          ? prev
          : [...prev, { ...created, pinned: false, category: createCategory ?? "MINE" }]
      )
      pick(created)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "거래처 등록 실패")
    } finally {
      setIsCreating(false)
    }
  }

  const rowClass = "flex min-h-14 w-full items-center justify-between gap-3 border-b py-2 text-left"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="max-h-[85svh] gap-0 p-0">
        <div className="flex items-center justify-between bg-muted px-4 py-1.5">
          <SheetTitle className="text-base font-medium">{title}</SheetTitle>
          <SheetDescription className="sr-only">거래처를 누르면 정해져요.</SheetDescription>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => onOpenChange(false)}
            className="-mr-2 flex size-10 items-center justify-center rounded-full text-muted-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-4 pt-3 pb-1">
          <label className="flex h-11 items-center gap-2 rounded-xl bg-muted px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름으로 찾기"
              enterKeyHint="done"
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>

        <div className="overflow-y-auto px-4 pb-6">
          {counts && !q ? (
            <button
              type="button"
              aria-pressed={selectedId === ""}
              onClick={() => pick(null)}
              className={rowClass}
            >
              <span className={cn("text-base", selectedId === "" && "font-semibold text-red-400")}>
                전체
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">{allCount ?? 0}{unit}</span>
            </button>
          ) : null}

          {sections.map((section) =>
            section.clients.length === 0 ? null : (
              <div key={section.title ?? "all"}>
                {section.title ? (
                  <p className="pt-3 pb-0.5 text-xs text-muted-foreground">{section.title}</p>
                ) : null}
                {section.clients.map((client) => {
                  const isSelected = client.id === selectedId
                  return (
                    <button
                      key={client.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => pick(client)}
                      className={rowClass}
                    >
                      <span
                        className={cn(
                          "min-w-0 text-base break-keep wrap-anywhere",
                          section.muted && "text-muted-foreground",
                          isSelected && "font-semibold text-red-400"
                        )}
                      >
                        {client.pinned ? <span className="mr-1.5 text-xs text-amber-400">★</span> : null}
                        {client.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {counts
                          ? `${counts[client.id] ?? 0}${unit}`
                          : client.biz_no
                            ? formatBizNo(client.biz_no)
                            : ""}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          )}

          {createCategory === undefined ? null : canCreate ? (
            <button
              type="button"
              disabled={isCreating}
              onClick={create}
              className="flex min-h-14 w-full items-center gap-2 text-left text-base font-semibold text-red-400 disabled:opacity-50"
            >
              <Plus className="size-4 shrink-0" />
              <span className="break-keep wrap-anywhere">
                &quot;{trimmed}&quot; 직접 입력 ({createCategory === "OTHER" ? "타 거래처로" : "거래처에"} 추가)
              </span>
            </button>
          ) : trimmed === "" ? (
            <button
              type="button"
              onClick={() => searchRef.current?.focus()}
              className="flex min-h-14 w-full items-center gap-2 text-left text-base font-semibold text-red-400"
            >
              <Plus className="size-4 shrink-0" />
              목록에 없으면 직접 입력
            </button>
          ) : null}

          {counts && q && shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">찾는 거래처가 없어요</p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
