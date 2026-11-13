"use client"

import { Copy, Plus } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import {
  isEntryType,
  LAST_ENTRY_TYPE_KEY,
  newEntryHref,
} from "@/lib/entry-type"

import { QuickEntrySheet } from "./quick-entry-sheet"

/** 떠 있는 버튼을 보여 줄 화면 (등록·수정 화면에서는 저장 바와 겹치지 않게 숨긴다) */
const SHOWN_ON = ["/", "/dispatches", "/stats", "/sales", "/expenses"]

/**
 * 모바일 오른쪽 아래 떠 있는 버튼 두 개 (가계부 앱 방식):
 * 차분한 벽돌빨강(#c4524e) ＋ = 통합 등록 화면(마지막에 고른 종류로), 회색 복사 = 이전 건 찾아 복사.
 */
export function FloatingActions() {
  const pathname = usePathname()
  const router = useRouter()

  if (!SHOWN_ON.includes(pathname)) return null

  function openNewEntry(event: React.MouseEvent<HTMLAnchorElement>) {
    let last: string | null = null
    try {
      last = localStorage.getItem(LAST_ENTRY_TYPE_KEY)
    } catch {
      last = null
    }
    if (isEntryType(last) && last !== "sale") {
      event.preventDefault()
      router.push(newEntryHref(last))
    }
  }

  return (
    <div className="fixed right-4 bottom-[4.5rem] z-40 flex items-center gap-3 md:hidden">
      <QuickEntrySheet
        mode="copy"
        trigger={
          <button
            type="button"
            aria-label="이전 건 복사"
            className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lg transition-transform active:scale-95"
          >
            <Copy className="size-5" aria-hidden />
          </button>
        }
      />
      <Link
        href={newEntryHref("sale")}
        onClick={openNewEntry}
        aria-label="등록"
        className="flex size-12 items-center justify-center rounded-full bg-[#c4524e] text-white shadow-lg transition-transform active:scale-95"
      >
        <Plus className="size-6" aria-hidden />
      </Link>
    </div>
  )
}
