"use client"

import { Copy, Plus } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

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
  // 마지막에 고른 종류(매출·지출·배차)로 여는 주소. 화면에 뜰 때 정해 두어 그 화면을 미리 받아 둘 수 있게 한다.
  const [entryHref, setEntryHref] = useState(newEntryHref("sale"))

  useEffect(() => {
    try {
      const last = localStorage.getItem(LAST_ENTRY_TYPE_KEY)
      if (isEntryType(last)) setEntryHref(newEntryHref(last))
    } catch {
      // 저장소를 못 쓰면 매출로 연다.
    }
    // 등록 화면에서 종류를 바꾸고 돌아오면 그 종류로 다시 맞춘다.
  }, [pathname])

  if (!SHOWN_ON.includes(pathname)) return null

  return (
    <div className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-3 md:hidden">
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
        href={entryHref}
        // 등록 화면을 미리 받아 두어 누르면 바로 뜨게 한다.
        prefetch
        aria-label="등록"
        className="flex size-12 items-center justify-center rounded-full bg-[#c4524e] text-white shadow-lg transition-transform active:scale-95"
      >
        <Plus className="size-6" aria-hidden />
      </Link>
    </div>
  )
}
