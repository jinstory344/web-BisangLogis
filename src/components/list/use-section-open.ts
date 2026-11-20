"use client"

import { useEffect, useState } from "react"

/**
 * 목록 묶음(예: 차량·거래처의 "전체")을 접고 펴는 상태. 휴대폰에 기억해서 다음에 열어도 그대로.
 * 기본은 펼침. 저장소를 못 쓰는 환경(사생활 보호 모드 등)이면 기억만 안 한다.
 */
export function useSectionOpen(key: string): [boolean, () => void] {
  const [open, setOpen] = useState(true)
  useEffect(() => {
    try {
      if (window.localStorage.getItem(key) === "closed") setOpen(false)
    } catch {}
  }, [key])
  const toggle = () =>
    setOpen((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(key, next ? "open" : "closed")
      } catch {}
      return next
    })
  return [open, toggle]
}
