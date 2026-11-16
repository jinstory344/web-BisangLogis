"use client"

import { ChevronRight, NotebookPen, Star, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { listMemosAction, type MemoItem } from "@/app/(app)/memos/actions"
import { CopyMemoButton } from "@/components/memos/copy-memo-button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { sortMemos } from "@/lib/memos"
import { cn } from "@/lib/utils"

/**
 * 떠 있는 버튼 줄의 업무메모 버튼(메모장+펜). 누르면 업무메모 판 — 고정(★) 먼저, 누르면 내용 펼침·복사.
 * 판을 열 때마다 서버에서 새로 받는다(다른 화면에서 고친 내용이 바로 보이게).
 */
export function WorkMemoButton() {
  const [open, setOpen] = useState(false)
  const [memos, setMemos] = useState<MemoItem[] | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  function openSheet() {
    setOpen(true)
    listMemosAction("WORK")
      .then((rows) => setMemos(sortMemos(rows)))
      .catch(() => setMemos([]))
  }

  return (
    <>
      <button
        type="button"
        aria-label="업무메모"
        onClick={openSheet}
        className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lg transition-transform active:scale-95"
      >
        <NotebookPen className="size-5" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="max-h-[85svh] gap-0 p-0">
          <div className="flex items-center justify-between bg-muted px-4 py-1.5">
            <SheetTitle className="text-base font-medium">업무메모</SheetTitle>
            <SheetDescription className="sr-only">메모를 누르면 내용이 펼쳐져요.</SheetDescription>
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setOpen(false)}
              className="-mr-2 flex size-10 items-center justify-center rounded-full text-muted-foreground"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="overflow-y-auto px-4">
            {memos === null ? (
              <p className="py-8 text-center text-sm text-muted-foreground">불러오는 중…</p>
            ) : memos.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                아직 업무메모가 없어요. 아래에서 써 보세요.
              </p>
            ) : (
              memos.map((memo) => {
                const isOpen = expanded === memo.id
                return (
                  <div key={memo.id} className="flex items-start gap-2 border-b py-3 last:border-b-0">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setExpanded(isOpen ? null : memo.id)}
                      className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                    >
                      <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                        {memo.pinned ? <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" /> : null}
                        <span className="break-keep wrap-anywhere">{memo.title}</span>
                      </span>
                      {memo.body ? (
                        <span
                          className={cn(
                            "text-[13px] leading-relaxed whitespace-pre-wrap text-muted-foreground",
                            !isOpen && "line-clamp-2"
                          )}
                        >
                          {memo.body}
                        </span>
                      ) : null}
                    </button>
                    <CopyMemoButton memo={memo} />
                  </div>
                )
              })
            )}
          </div>

          <Link
            href="/memos?tab=work"
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center justify-end gap-1 border-t px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-[15px] font-semibold text-red-400"
          >
            메모 페이지로 이동
            <ChevronRight className="size-4" />
          </Link>
        </SheetContent>
      </Sheet>
    </>
  )
}
