"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

/** 이만큼(px) 끌어내리면 놓을 때 새로 고침 */
const TRIGGER = 64
const MAX = 110

/**
 * 맨 위에서 아래로 쓸어내리면 새로 고침(데스크톱의 F5).
 * 아이폰 홈 화면 앱에는 기본 기능이 없어서 직접 만든다. 화면을 다시 띄우지 않고
 * router.refresh()로 서버에서 최신 내용만 다시 받는다.
 * 아래에서 올라온 판(시트·메뉴) 안이나 옆으로 넘기기(달 넘기기)는 건드리지 않는다.
 */
export function PullToRefresh() {
  const router = useRouter()
  const [pull, setPull] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const busyRef = useRef(false)

  useEffect(() => {
    let startX = 0
    let startY: number | null = null
    let distance = 0

    const reset = () => {
      startY = null
      distance = 0
      setPull(0)
    }
    const onStart = (e: TouchEvent) => {
      if (busyRef.current || window.scrollY > 0 || e.touches.length !== 1) return
      const target = e.target as Element | null
      if (target?.closest('[role="dialog"],[role="menu"],[data-no-pull]')) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      distance = 0
    }
    const onMove = (e: TouchEvent) => {
      if (startY === null) return
      const dy = e.touches[0].clientY - startY
      const dx = Math.abs(e.touches[0].clientX - startX)
      // 아주 작은 떨림은 무시
      if (Math.abs(dy) < 4 && dx < 4) return
      // 옆으로 넘기는 손짓이거나 위로 올리거나 이미 스크롤됐으면 그만
      if (dx > Math.abs(dy) || dy <= 0 || window.scrollY > 0) {
        if (distance > 0) reset()
        else startY = null
        return
      }
      distance = Math.min(dy * 0.5, MAX)
      setPull(distance)
    }
    const onEnd = () => {
      if (startY === null) return
      const reached = distance >= TRIGGER
      startY = null
      distance = 0
      if (!reached) {
        setPull(0)
        return
      }
      setPull(TRIGGER)
      setIsRefreshing(true)
      busyRef.current = true
      router.refresh()
      // 새 내용은 받는 대로 바뀐다. 도는 표시는 "새로 고쳤다"는 확인용으로 잠깐만
      window.setTimeout(() => {
        busyRef.current = false
        setIsRefreshing(false)
        setPull(0)
      }, 700)
    }

    window.addEventListener("touchstart", onStart, { passive: true })
    window.addEventListener("touchmove", onMove, { passive: true })
    window.addEventListener("touchend", onEnd)
    window.addEventListener("touchcancel", reset)
    return () => {
      window.removeEventListener("touchstart", onStart)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("touchend", onEnd)
      window.removeEventListener("touchcancel", reset)
    }
  }, [router])

  // 사파리처럼: 화면 전체가 아래로 밀리고, 위에 생긴 빈 공간에 아이폰식 로딩 표시(살 8개)
  const height = isRefreshing ? 52 : pull
  const progress = Math.min(pull / TRIGGER, 1)
  const spokes = isRefreshing ? 8 : Math.ceil(progress * 8)
  return (
    <div
      aria-live="polite"
      data-pull-indicator
      className={cn(
        "flex items-end justify-center overflow-hidden",
        // 손을 떼면 부드럽게 접히고, 끄는 동안은 손가락을 바로 따라간다
        isRefreshing || pull === 0 ? "transition-[height] duration-200" : ""
      )}
      style={{ height }}
    >
      {height > 0 ? (
        <svg
          viewBox="0 0 24 24"
          className="mb-3 size-6 text-muted-foreground"
          style={isRefreshing ? { animation: "spin 0.8s steps(8, end) infinite" } : undefined}
          aria-hidden
        >
          {Array.from({ length: 8 }, (_, i) => (
            <line
              key={i}
              x1="12"
              y1="3"
              x2="12"
              y2="7.5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              transform={`rotate(${i * 45} 12 12)`}
              opacity={i < spokes ? 1 - i * 0.1 : 0}
            />
          ))}
        </svg>
      ) : null}
      <span className="sr-only">{isRefreshing ? "새로 고치는 중" : pull > 0 ? "놓으면 새로 고침" : ""}</span>
    </div>
  )
}
