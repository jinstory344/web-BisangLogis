"use client"

import { ChevronLeft, ChevronRight, Copy, MessageSquare, Share, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { listMemosAction, type MemoItem } from "@/app/(app)/memos/actions"
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
 * - driver: 차주에게 배차내용 — 먼저 그 거래처 메모 + 공통 배차메모 목록이 뜨고(경로가 맞는 메모가 맨 위),
 *   하나를 고르면 그 내용이 칸에 들어간다. 고칠 곳만 고쳐서 [문자](차주 번호로 문자 앱) 또는 [복사].
 * - client: 거래처에게 배차정보 — 배차에 저장된 값으로 자동 작성. [카톡]은 공유 창, [문자]는 담당자 번호(있으면).
 * 둘 다 칸에서 바로 고칠 수 있다.
 */
export function DispatchMessageSheet({
  target,
  dispatch,
  clientName,
  onOpenChange,
}: {
  target: MessageTarget | null
  dispatch: DispatchRow | null
  clientName: string
  onOpenChange: (open: boolean) => void
}) {
  const open = target !== null && dispatch !== null
  const [memos, setMemos] = useState<MemoItem[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [text, setText] = useState("")
  /** 경로가 맞는 메모 (목록 맨 위에 "추천") */
  const [matchedId, setMatchedId] = useState<string | null>(null)

  // 판을 열 때마다 문구를 새로 만든다
  useEffect(() => {
    if (!open || !dispatch) return
    if (target === "client") {
      setText(buildDispatchInfo(dispatch))
      return
    }
    setMemos(null)
    setSelectedId(null)
    setText("")
    setMatchedId(null)
    let alive = true
    listMemosAction("DISPATCH")
      .then((rows) => {
        if (!alive) return
        const mine = sortMemos(rows.filter((m) => m.client_id === null || m.client_id === dispatch.client_id))
        const matched = matchRouteMemo(mine, dispatch.origin, dispatch.destination)
        setMatchedId(matched)
        // 경로가 맞는 메모를 맨 위로
        setMemos(matched ? [...mine.filter((m) => m.id === matched), ...mine.filter((m) => m.id !== matched)] : mine)
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

  const isPicking = target === "driver" && selectedId === null
  const selectedMemo = memos?.find((m) => m.id === selectedId)
  const memoRow = (memo: MemoItem) => (
    <button
      key={memo.id}
      type="button"
      onClick={() => pick(memo)}
      className="flex min-h-14 w-full items-center gap-2 border-b py-2.5 text-left active:bg-muted/60"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold">{memo.title}</span>
          {memo.id === matchedId ? (
            <span className="shrink-0 rounded-full bg-[#34507d] px-2 py-0.5 text-[11px] font-semibold text-[#e3ecfb]">
              경로 맞음
            </span>
          ) : null}
        </span>
        {memo.body ? (
          <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{memo.body.replace(/\s+/g, " ")}</span>
        ) : null}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
  const clientMemos = memos?.filter((m) => m.client_id) ?? []
  const commonMemos = memos?.filter((m) => !m.client_id) ?? []

  const buttonClass = "flex h-12 items-center justify-center gap-1.5 rounded-xl text-[15px] font-semibold"

  return (
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
            {isPicking ? (
              memos === null ? (
                <p className="py-6 text-center text-sm text-muted-foreground">메모 불러오는 중…</p>
              ) : memos.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  아직 {clientName} 배차메모가 없어요.
                  <Link
                    href={`/memos?tab=dispatch${dispatch.client_id ? `&client=${dispatch.client_id}` : ""}`}
                    className="mx-auto mt-3 flex h-10 w-fit items-center gap-1 rounded-full bg-muted px-4 text-foreground"
                  >
                    메모 페이지에서 만들기 <ChevronRight className="size-4" />
                  </Link>
                </div>
              ) : (
                <div className="pb-4">
                  <p className="text-sm text-muted-foreground">보낼 배차메모를 고르세요</p>
                  {clientMemos.length > 0 ? (
                    <>
                      <p className="mt-3 text-xs text-muted-foreground">{clientName} 메모</p>
                      {clientMemos.map(memoRow)}
                    </>
                  ) : null}
                  {commonMemos.length > 0 ? (
                    <>
                      <p className="mt-3 text-xs text-muted-foreground">공통 메모</p>
                      {commonMemos.map(memoRow)}
                    </>
                  ) : null}
                </div>
              )
            ) : (
              <>
            {target === "driver" ? (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="-ml-1 flex h-9 w-fit items-center gap-0.5 text-sm text-muted-foreground"
              >
                <ChevronLeft className="size-4" /> 메모 다시 고르기
                {selectedMemo ? <span className="ml-1 font-semibold text-foreground">· {selectedMemo.title}</span> : null}
              </button>
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
              </>
            )}
          </div>

          {isPicking ? null : (
          <div
            className={cn(
              "grid gap-2 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
              target === "driver" ? "grid-cols-[1fr_2fr]" : "grid-cols-3"
            )}
          >
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
          )}
        </SheetContent>
      </Sheet>
  )
}
