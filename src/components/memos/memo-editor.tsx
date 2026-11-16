"use client"

import { ChevronRight, Star, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { deleteMemoAction, saveMemoAction, type MemoItem } from "@/app/(app)/memos/actions"
import { ClientSheet } from "@/components/clients/client-sheet"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import type { MemoKind } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

export interface MemoDraft {
  id?: string
  kind: MemoKind
  client_id: string | null
  title: string
  body: string
  pinned: boolean
}

const KIND_LABEL: Record<MemoKind, string> = { DISPATCH: "배차메모", WORK: "업무메모" }

/**
 * 메모 쓰기·고치기 판 (아래에서 거의 화면 가득 올라온다).
 * 종류(배차메모/업무메모) · 둘 곳(공통/거래처) · 제목 · 내용 · ★고정. 고칠 때는 지우기도 있다.
 */
export function MemoEditor({
  open,
  onOpenChange,
  draft,
  clientNames,
  onSaved,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: MemoDraft
  clientNames: Record<string, string>
  onSaved: (memo: MemoItem) => void
  onDeleted?: (id: string) => void
}) {
  const [value, setValue] = useState(draft)
  const [isClientOpen, setIsClientOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [pickedName, setPickedName] = useState<string | null>(null)

  // 판을 열 때마다 넘겨받은 값으로 새로 채운다
  useEffect(() => {
    if (open) {
      setValue(draft)
      setPickedName(null)
    }
  }, [open, draft])

  const set = <K extends keyof MemoDraft>(key: K, v: MemoDraft[K]) =>
    setValue((prev) => ({ ...prev, [key]: v }))
  const clientName = value.client_id ? (pickedName ?? clientNames[value.client_id] ?? "거래처") : null

  async function save() {
    setIsBusy(true)
    const result = await saveMemoAction(value)
    setIsBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("메모를 저장했어요")
    onSaved(result.memo)
    onOpenChange(false)
  }

  async function remove() {
    if (!value.id || !window.confirm(`'${value.title}' 메모를 지울까요?`)) return
    setIsBusy(true)
    const result = await deleteMemoAction(value.id)
    setIsBusy(false)
    if (!result.ok) {
      toast.error(result.error ?? "메모 삭제 실패")
      return
    }
    onDeleted?.(value.id)
    onOpenChange(false)
  }

  const segClass = (on: boolean) =>
    cn(
      "flex h-10 min-w-0 items-center justify-center gap-1 rounded-full px-3 text-sm",
      on ? "bg-foreground font-semibold text-background" : "bg-muted text-muted-foreground"
    )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="h-[92svh] gap-0 p-0">
        <div className="flex items-center justify-between bg-muted px-4 py-1.5">
          <SheetTitle className="text-base font-medium">{value.id ? "메모 고치기" : "새 메모"}</SheetTitle>
          <SheetDescription className="sr-only">메모를 쓰고 저장해요.</SheetDescription>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => onOpenChange(false)}
            className="-mr-2 flex size-10 items-center justify-center rounded-full text-muted-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-3 pb-4">
          <div className="grid grid-cols-2 gap-1.5">
            {(["DISPATCH", "WORK"] as const).map((kind) => (
              <button key={kind} type="button" className={segClass(value.kind === kind)} onClick={() => set("kind", kind)}>
                {KIND_LABEL[kind]}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">어디에 둘까요</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" className={segClass(!value.client_id)} onClick={() => set("client_id", null)}>
                공통 (모든 거래처)
              </button>
              <button type="button" className={segClass(!!value.client_id)} onClick={() => setIsClientOpen(true)}>
                <span className="truncate">{clientName ?? "거래처 고르기"}</span>
                <ChevronRight className="size-4 shrink-0" />
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">
              제목{value.kind === "DISPATCH" ? " (경로)" : ""}
            </span>
            <input
              value={value.title}
              onChange={(e) => set("title", e.target.value)}
              maxLength={100}
              placeholder={value.kind === "DISPATCH" ? "예: 인천남동 - 광주 삼진냉장" : "예: 평택창고 출입"}
              className="h-11 rounded-lg border bg-transparent px-3 text-base outline-none focus:border-foreground/40"
            />
            {value.kind === "DISPATCH" ? (
              <span className="text-[11px] text-muted-foreground">
                배차 경로와 비슷하면 차주 문자 보낼 때 이 메모를 먼저 골라 둬요
              </span>
            ) : null}
          </label>

          <label className="flex min-h-48 flex-1 flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">내용</span>
            <textarea
              value={value.body}
              onChange={(e) => set("body", e.target.value)}
              maxLength={5000}
              className="min-h-48 flex-1 resize-none rounded-lg border bg-transparent px-3 py-2.5 text-base leading-relaxed outline-none focus:border-foreground/40"
            />
          </label>

          <button
            type="button"
            aria-pressed={value.pinned}
            onClick={() => set("pinned", !value.pinned)}
            className="flex h-10 items-center gap-2 text-sm"
          >
            <Star className={cn("size-5", value.pinned ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
            맨 위에 고정{value.kind === "WORK" ? " (홈 메모 버튼에서 먼저 보여요)" : ""}
          </button>
        </div>

        <div className="flex gap-2 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {value.id ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={remove}
              className="h-12 rounded-xl px-4 text-sm text-destructive disabled:opacity-50"
            >
              지우기
            </button>
          ) : null}
          <button
            type="button"
            disabled={isBusy}
            onClick={save}
            className="h-12 flex-1 rounded-xl bg-foreground text-base font-semibold text-background disabled:opacity-50"
          >
            저장
          </button>
        </div>

        <ClientSheet
          open={isClientOpen}
          onOpenChange={setIsClientOpen}
          selectedId={value.client_id ?? ""}
          onPick={(client) => {
            if (!client) return
            set("client_id", client.id)
            setPickedName(client.name)
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
