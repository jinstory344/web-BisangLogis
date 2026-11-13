"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

const PAGE_CACHE = "bisang-pages-v1"

/** 서비스 워커(public/sw.js) 등록. 실제 사이트에서만 (개발 서버에서는 저장 화면이 헷갈리게 하므로 끈다). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 등록에 실패해도 앱은 그대로 쓸 수 있다.
    })
  }, [])
  return null
}

/** 로그아웃할 때 폰에 저장해 둔 HOME 화면을 지운다. */
export function clearPageCache() {
  try {
    if ("caches" in window) void caches.delete(PAGE_CACHE)
  } catch {
    // 지우지 못해도 다음 로그인 때 새 화면으로 덮어쓴다.
  }
}

/** 이 문서(페이지 전체 로드)에서 한 번만 확인한다 */
let checkedThisLoad = false

/**
 * 폰에 저장해 둔 옛 HOME 화면으로 열렸으면(서버가 그린 시각이 오래됐으면) 바로 최신으로 다시 그린다.
 * 화면 안 이동으로 다시 그려질 때는 확인하지 않는다(페이지를 처음 연 순간에만).
 */
export function RefreshIfStale({ renderedAt }: { renderedAt: number }) {
  const router = useRouter()
  useEffect(() => {
    if (checkedThisLoad) return
    checkedThisLoad = true
    if (Date.now() - renderedAt > 10_000) router.refresh()
  }, [renderedAt, router])
  return null
}
