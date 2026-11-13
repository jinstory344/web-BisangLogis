"use client"

import { Search } from "lucide-react"
import { useRouter } from "next/navigation"

/** 검색 화면이 뜰 때까지 키보드를 붙잡아 두는 임시 입력칸의 id */
export const SEARCH_KEYBOARD_PROXY_ID = "search-keyboard-proxy"

/**
 * 화면 왼쪽 위 돋보기. 누르면 검색 화면으로 가면서 키보드가 바로 올라온다.
 * iPhone은 사용자가 누른 그 순간에만 키보드를 열어 주므로, 누르는 순간 보이지 않는 임시 입력칸에
 * 커서를 둬서 키보드를 먼저 열고, 검색 화면의 검색창이 뜨면 커서를 그리로 옮긴다(SearchBox).
 */
export function SearchButton() {
  const router = useRouter()

  function open() {
    try {
      let proxy = document.getElementById(SEARCH_KEYBOARD_PROXY_ID) as HTMLInputElement | null
      if (!proxy) {
        proxy = document.createElement("input")
        proxy.id = SEARCH_KEYBOARD_PROXY_ID
        proxy.type = "text"
        proxy.setAttribute("aria-hidden", "true")
        proxy.tabIndex = -1
        // 16px 이상이어야 iPhone이 화면을 확대하지 않는다
        proxy.style.cssText =
          "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;pointer-events:none;"
        document.body.appendChild(proxy)
      }
      proxy.focus()
    } catch {
      // 임시 입력칸을 못 만들어도 검색 화면으로는 간다
    }
    router.push("/search")
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label="검색"
      className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Search className="size-5" />
    </button>
  )
}
