"use client"

import { Search } from "lucide-react"
import { useEffect, useRef } from "react"

import { SEARCH_KEYBOARD_PROXY_ID } from "@/components/layout/search-button"
import { Input } from "@/components/ui/input"
import { SEARCH_MAX_LENGTH } from "@/lib/search"

/**
 * 검색창. 검색어 없이 들어오면 바로 커서를 둬서 곧장 타이핑할 수 있게 한다.
 * 돋보기를 누를 때 열어 둔 키보드(임시 입력칸)에서 커서를 넘겨받고 임시 입력칸은 지운다.
 * 결과를 보고 있을 때(검색어가 있을 때)는 키보드가 목록을 가리지 않게 커서를 두지 않는다.
 */
export function SearchBox({ query }: { query: string }) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const proxy = document.getElementById(SEARCH_KEYBOARD_PROXY_ID)
    if (!query) inputRef.current?.focus()
    proxy?.remove()
  }, [query])

  return (
    <form action="/search" role="search" className="relative mt-1 mb-1">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={query}
        autoFocus={!query}
        maxLength={SEARCH_MAX_LENGTH}
        enterKeyHint="search"
        aria-label="검색어"
        className="h-10 pl-9 text-base"
      />
    </form>
  )
}
