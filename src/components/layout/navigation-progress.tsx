"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

/**
 * 화면을 옮기는 동안 맨 위에 보이는 얇은 빨간 진행 막대.
 * 회색 뼈대 화면(loading.tsx) 대신 지금 화면을 그대로 둔 채 막대만 움직여서 덜 끊겨 보이게 한다.
 * 앱 안 링크를 누르면 시작하고, 주소(경로·쿼리)가 바뀌면 끝난다.
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [active, setActive] = useState(false)

  // 새 화면이 도착하면 끝
  useEffect(() => {
    setActive(false)
  }, [pathname, searchParams])

  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Next의 Link는 기본 동작을 막고 직접 이동하므로 defaultPrevented는 보지 않는다(캡처 단계에서 먼저 받는다).
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.("a[href]")
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target && anchor.target !== "_self") return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      setActive(true)
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  // 혹시 이동이 취소되면 오래 남지 않게 정리
  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => setActive(false), 10000)
    return () => window.clearTimeout(timer)
  }, [active])

  if (!active) return null
  return (
    <div
      role="progressbar"
      aria-label="화면 불러오는 중"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
    >
      <div className="h-full w-1/3 animate-[nav-progress_1s_ease-in-out_infinite] bg-red-400" />
    </div>
  )
}
