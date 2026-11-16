"use client"

import { ChevronRight, Plus, Search, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  listClientsAction,
  quickCreateClientAction,
  type ClientSearchResult,
} from "@/app/(app)/clients/actions"
import { ClientCombobox } from "@/components/clients/client-combobox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatBizNo } from "@/lib/biz-no"
import { cn } from "@/lib/utils"

type ListedClient = ClientSearchResult & { pinned: boolean }

/** 띄어쓰기·대소문자·사업자번호의 "-"를 무시하고 비교 */
const normalize = (text: string) => text.replace(/[\s-]/g, "").toLowerCase()

/**
 * 거래처 고르기 (배차 폼).
 * 모바일: 고른 거래처만 한 줄로 보이고, 누르면 아래에서 거래처 판이 올라온다(카드·하차일 선택판과 같은 방식).
 *   위에 찾기 칸, 고정한 거래처(★) 먼저, 맨 아래 "직접 입력" — 고르면 바로 거래처 페이지에도 추가된다.
 * 데스크톱(md 이상): 기존 거래처 상자 그대로.
 */
export function ClientPickerSheet({
  value,
  onChange,
  invalid = false,
}: {
  value: ClientSearchResult | null
  onChange: (client: ClientSearchResult | null) => void
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [clients, setClients] = useState<ListedClient[]>([])
  const [query, setQuery] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listClientsAction()
      .then(setClients)
      .catch(() => setClients([]))
  }, [])

  const trimmed = query.trim()
  const q = normalize(trimmed)
  const shown = q
    ? clients.filter((c) => normalize(c.name).includes(q) || (c.biz_no ?? "").includes(q))
    : clients
  const canCreate = trimmed !== "" && !clients.some((c) => c.name === trimmed)

  function pick(client: ClientSearchResult) {
    onChange(client)
    setOpen(false)
  }

  async function create() {
    setIsCreating(true)
    try {
      const created = await quickCreateClientAction(trimmed)
      setClients((prev) =>
        prev.some((c) => c.id === created.id) ? prev : [...prev, { ...created, pinned: false }]
      )
      pick(created)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "거래처 등록 실패")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <>
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => {
            setQuery("")
            setOpen(true)
          }}
          aria-haspopup="dialog"
          aria-label={`거래처, 현재 ${value?.name ?? "없음"}`}
          className={cn(
            "flex min-h-11 w-full items-center justify-between gap-2 border-b text-left text-base",
            invalid ? "border-destructive" : "border-border",
            value ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <span className="truncate">{value?.name ?? "거래처 선택"}</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="max-h-[85svh] gap-0 p-0"
          >
            <div className="flex items-center justify-between bg-muted px-4 py-1.5">
              <SheetTitle className="text-base font-medium">거래처 선택</SheetTitle>
              <SheetDescription className="sr-only">거래처를 누르면 정해져요.</SheetDescription>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setOpen(false)}
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
              {shown.map((client) => {
                const isSelected = client.id === value?.id
                return (
                  <button
                    key={client.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => pick(client)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 border-b py-2 text-left"
                  >
                    <span
                      className={cn(
                        "min-w-0 text-base break-keep wrap-anywhere",
                        isSelected && "font-semibold text-red-400"
                      )}
                    >
                      {client.pinned ? <span className="mr-1.5 text-xs text-amber-400">★</span> : null}
                      {client.name}
                    </span>
                    {client.biz_no ? (
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {formatBizNo(client.biz_no)}
                      </span>
                    ) : null}
                  </button>
                )
              })}

              {canCreate ? (
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={create}
                  className="flex min-h-14 w-full items-center gap-2 text-left text-base font-semibold text-red-400 disabled:opacity-50"
                >
                  <Plus className="size-4 shrink-0" />
                  <span className="break-keep wrap-anywhere">
                    &quot;{trimmed}&quot; 직접 입력 (거래처에 추가)
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
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden md:block">
        <ClientCombobox value={value} onChange={onChange} />
      </div>
    </>
  )
}
