"use client"

import { useLayoutEffect, useRef, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/** 고정 머리 바로 아래에 붙어 고정될 것(칩 줄·"고정/전체" 묶음 머리)이 쓰는 top 값 */
export const UNDER_STICKY_HEAD = "top-[var(--sticky-head-h,0px)]"

/**
 * 스크롤해도 위에 고정되는 머리. 자기 높이를 재서 --sticky-head-h에 적어 두어,
 * 그 아래에 붙을 칩 줄·묶음 머리가 정확히 머리 바로 밑에 고정되게 한다(머리 높이는 화면마다·데이터마다 달라서).
 */
export function StickyHead({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // 실제 높이는 177.5px처럼 소수라, 반올림한 offsetHeight(178)를 쓰면 0.5px 틈으로 아래 목록이 비친다.
    // 내림한 뒤 1px 더 빼서 아래 줄이 머리 밑으로 살짝 겹치게 한다(머리가 위에 그려져 겹친 부분은 안 보임).
    const set = () =>
      document.documentElement.style.setProperty(
        "--sticky-head-h",
        `${Math.max(0, Math.floor(el.getBoundingClientRect().height) - 1)}px`
      )
    set()
    const observer = new ResizeObserver(set)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={cn("sticky top-0 z-30 bg-background", className)}>
      {children}
    </div>
  )
}
