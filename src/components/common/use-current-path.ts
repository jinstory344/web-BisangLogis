"use client"

import { usePathname, useSearchParams } from "next/navigation"

/** 지금 화면의 주소(경로 + 쿼리). 수정 링크의 "돌아갈 주소"로 쓴다. */
export function useCurrentPath(): string {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams.toString()
  return query ? `${pathname}?${query}` : pathname
}
