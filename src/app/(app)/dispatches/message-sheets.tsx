"use client"

import { Copy, MessageSquare, Plus, Save, Share, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { listMemosAction, type MemoItem } from "@/app/(app)/memos/actions"
import { MemoEditor, type MemoDraft } from "@/components/memos/memo-editor"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { buildDispatchInfo, matchRouteMemo, smsHref, sortMemos } from "@/lib/memos"
import type { DispatchRow } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

export type MessageTarget = "driver" | "client"

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1))

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success("복사했어요")
  } catch {
    toast.error("복사하지 못했어요")
  }
}

/**
 * 배차 한 건의 문자 판.
 * - driver: 차주에게 배차내용 — 그 거래처 메모 + 공통 배차메모를 칩으로, 경로가 맞는 메모를 미리 골라 둔다.
 *   [메모로 저장]으로 고친 내용을 메모로 남긴다. [문자]는 그 배차의 차주 번호로 문자 앱을 연다.
 * - client: 거래처에게 배차정보 — 배차에 저장된 값으로 자동 작성. [카톡]은 공유 창, [문자]는 담당자 번호(있으면).
 * 둘 다 칸에서 바로 고칠 수 있다.
 */
export function DispatchMessageSheet({
  target,
  dispatch,
  clientName,
  clientNames,
  onOpenChange,
}: {
  target: MessageTarget | null
  dispatch: DispatchRow | null
  clientName: string
  clientNames: Record<string, string>
  onOpenChange: (open: boolean) => void
}) {
  const open = target !== null && dispatch !== null
  const [memos, setMemos] = useState<MemoItem[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [editor, setEditor] = useState<{ open: boolean; draft: MemoDraft }>({
    open: false,
    draft: { kind: "DISPATCH", client_id: null, title: "", body: "", pinned: false },
  })

  // 판을 열 때마다 문구를 새로 만든다
  useEffect(() => {
    if (!open || !dispatch) return
    if (target === "client") {
      setText(buildDispatchInfo(dispatch))
      return
    }
    setMemos(null)
    setSelectedId(null)
    setText(`${dispatch.origin} - ${dispatch.destination}`)
    let alive = true
    listMemosAction("DISPATCH")
      .then((rows) => {
        if (!alive) return
        const mine = sortMemos(rows.filter((m) => m.client_id === null || m.client_id === dispatch.client_id))
        setMemos(mine)
        const matched = matchRouteMemo(mine, dispatch.origin, dispatch.destination)
        const memo = mine.find((m) => m.id === matched)
        if (memo) {
          setSelectedId(memo.id)
          setText(memo.body || memo.title)
        }
      })
      .catch(() => alive && setMemos([]))
    return () => {
      alive = false
    }
  }, [open, target, dispatch])

  if (!dispatch) return null

  const phone =
    target === "driver" ? dispatch.driver_phone_snapshot?.trim() : dispatch.contact_phone?.trim()
  const who =
    target === "driver"
      ? `${dispatch.driver_name_snapshot?.trim() || "차주"}님께 · 배차내용`
      : `${clientName}에게 · 배차정보`

  function pick(memo: MemoItem) {
    setSelectedId(memo.id)
    setText(memo.body || memo.title)
  }

  /** asNew: 지금 칸의 내용으로 새 메모. 아니면 고른 메모가 있을 때 그 메모를 지금 내용으로 고친다. */
  function openEditor(asNew: boolean) {
    const selected = memos?.find((m) => m.id === selectedId)
    setEditor({
      open: true,
      draft:
        selected && !asNew
          ? { ...selected, body: text }
          : {
              kind: "DISPATCH",
              client_id: dispatch!.client_id,
              title: `${dispatch!.origin} - ${dispatch!.destination}`,
              body: text,
              pinned: false,
            },
    })
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text })
      } catch {
        // 공유 창을 닫은 경우 — 아무것도 안 한다
      }
      return
    }
    await copyText(text)
  }

  const clientMemos = memos?.filter((m) => m.client_id) ?? []
  const commonMemos = memos?.filter((m) => !m.client_id) ?? []
  const chip = (memo: MemoItem) => (
    <button
      key={memo.id}
      type="button"
      aria-pressed={memo.id === selectedId}
      onClick={() => pick(memo)}
      className={cn(
        "h-9 max-w-full truncate rounded-full px-3.5 text-sm",
        memo.id === selectedId ? "bg-foreground font-semibold text-background" : "bg-muted text-foreground"
      )}
    >
      {memo.title}
    </button>
  )

  const buttonClass = "flex h-12 items-center justify-center gap-1.5 rounded-xl text-[15px] font-semibold"

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" showCloseButton={false} className="max-h-[92svh] gap-0 p-0">
          <div className="flex items-center justify-between bg-muted px-4 py-1.5">
            <SheetTitle className="min-w-0 truncate text-base font-medium">{who}</SheetTitle>
            <SheetDescription className="sr-only">문구를 고치고 보낼 수 있어요.</SheetDescription>
            <button
              type="button"
              aria-label="닫기"
              onClick={() => onOpenChange(false)}
              className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto px-4 pt-3">
            {target === "driver" ? (
              memos === null ? (
                <p className="text-sm text-muted-foreground">메모 불러오는 중…</p>
              ) : (
                <>
                  {clientMemos.length > 0 ? (
                    <div>
                      <p className="mb-1.5 text-xs text-muted-foreground">{clientName} 메모</p>
                      <div className="flex flex-wrap gap-1.5">{clientMemos.map(chip)}</div>
                    </div>
                  ) : null}
                  <div>
                    <p className="mb-1.5 text-xs text-muted-foreground">공통 메모</p>
                    <div className="flex flex-wrap gap-1.5">
                      {commonMemos.map(chip)}
                      <button
                        type="button"
                        onClick={() => openEditor(true)}
                        className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed px-3.5 text-sm text-muted-foreground"
                      >
                        <Plus className="size-4" /> 새 메모
                      </button>
                    </div>
                  </div>
                </>
              )
            ) : null}

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={target === "driver" ? 11 : 8}
              className="mt-1 w-full resize-none rounded-xl border bg-transparent px-3 py-2.5 text-base leading-relaxed outline-none focus:border-foreground/40"
            />
            <p className="text-xs text-muted-foreground">
              받는 번호: {phone || (target === "driver" ? "차주 번호 없음 — 문자 앱에서 골라요" : "담당자 번호 없음 — 카톡으로 보내거나 문자 앱에서 골라요")}
            </p>
          </div>

          <div
            className={cn(
              "grid gap-2 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
              target === "driver" ? "grid-cols-[auto_auto_1fr]" : "grid-cols-3"
            )}
          >
            {target === "driver" ? (
              <button type="button" onClick={() => openEditor(false)} className={cn(buttonClass, "bg-muted px-3")}>
                <Save className="size-4" /> 메모로 저장
              </button>
            ) : null}
            <button type="button" onClick={() => copyText(text)} className={cn(buttonClass, "bg-muted px-3")}>
              <Copy className="size-4" /> 복사
            </button>
            {target === "client" ? (
              <button type="button" onClick={share} className={cn(buttonClass, "bg-[#fee500] text-[#191919]")}>
                <Share className="size-4" /> 카톡
              </button>
            ) : null}
            <a
              href={smsHref(phone, text, isIOS())}
              className={cn(buttonClass, "bg-[#c4524e] text-white")}
            >
              <MessageSquare className="size-4" /> 문자
            </a>
          </div>
        </SheetContent>
      </Sheet>

      <MemoEditor
        open={editor.open}
        onOpenChange={(o) => setEditor((prev) => ({ ...prev, open: o }))}
        draft={editor.draft}
        clientNames={clientNames}
        onSaved={(memo) => {
          setMemos((prev) =>
            prev ? sortMemos([memo, ...prev.filter((m) => m.id !== memo.id)]) : prev
          )
          if (memo.kind === "DISPATCH") {
            setSelectedId(memo.id)
            setText(memo.body || memo.title)
          }
        }}
        onDeleted={(id) => setMemos((prev) => prev?.filter((m) => m.id !== id) ?? prev)}
      />
    </>
  )
}
