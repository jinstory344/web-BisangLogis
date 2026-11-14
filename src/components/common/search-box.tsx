"use client"

import { Search, X } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

/** 목록 위 검색창 (차량 정보·거래처): 살짝 떠 있는 둥근 카드, 입력하면 오른쪽에 ✕(지우기) */
export function SearchBox({
  defaultValue,
  placeholder,
}: {
  defaultValue: string
  placeholder: string
}) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set("q", value)
      } else {
        params.delete("q")
      }
      router.replace(`${pathname}?${params.toString()}`)
    }, 300)

    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className="flex h-13 items-center gap-2.5 rounded-2xl border border-white/15 bg-card px-3.5 shadow-md shadow-black/25 focus-within:border-white/30 md:max-w-md">
      <Search className="size-5 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="검색어 지우기"
          onClick={() => {
            setValue("")
            inputRef.current?.focus()
          }}
          className="-mr-1.5 flex size-9 shrink-0 items-center justify-center"
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-muted-foreground/60 text-card">
            <X className="size-3.5" strokeWidth={3} />
          </span>
        </button>
      ) : null}
    </div>
  )
}
