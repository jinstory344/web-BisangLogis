"use client"

import { Copy } from "lucide-react"
import { toast } from "sonner"

import type { MemoItem } from "@/app/(app)/memos/actions"

/** 메모 줄 오른쪽 복사 버튼 — 내용(없으면 제목)을 복사한다. 줄을 누르는 동작과 겹치지 않게 따로 둔다. */
export function CopyMemoButton({ memo }: { memo: Pick<MemoItem, "title" | "body"> }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(memo.body || memo.title)
      toast.success(`'${memo.title}' 복사했어요`)
    } catch {
      toast.error("복사하지 못했어요")
    }
  }

  return (
    <button
      type="button"
      aria-label={`${memo.title} 복사`}
      onClick={copy}
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background/60 text-foreground active:opacity-70"
    >
      <Copy className="size-4" />
    </button>
  )
}
