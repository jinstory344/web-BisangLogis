"use client"

import { useEffect } from "react"

/**
 * 폰 글자 키보드가 올라오면 입력 중인 칸이 키보드에 가리지 않게 위로 민다.
 * (브라우저가 스스로 올려 주지만, 아래에 고정된 저장 버튼 줄 등 때문에 가려지는 경우가 있어 한 번 더 맞춘다)
 */
export function KeepFocusedVisible() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    let timer: number | undefined

    function adjust() {
      const el = document.activeElement
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return
      if (!viewport) return
      const rect = el.getBoundingClientRect()
      // 보이는 화면 아래에서 저장 버튼 줄 높이(약 80px)만큼은 비켜 둔다
      const visibleBottom = viewport.offsetTop + viewport.height - 80
      if (rect.bottom > visibleBottom) window.scrollBy({ top: rect.bottom - visibleBottom, behavior: "smooth" })
    }
    function onFocusIn() {
      window.clearTimeout(timer)
      // 키보드가 다 올라온 뒤에 잰다
      timer = window.setTimeout(adjust, 350)
    }
    document.addEventListener("focusin", onFocusIn)
    viewport.addEventListener("resize", onFocusIn)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("focusin", onFocusIn)
      viewport.removeEventListener("resize", onFocusIn)
    }
  }, [])
  return null
}
