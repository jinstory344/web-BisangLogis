"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, type ReactNode } from "react"

/** 넘긴 방향을 다음 화면에 알려 주는 저장소 키 (새 달이 그쪽에서 밀려 들어오게) */
const DIRECTION_KEY = "bisang:swipeDirection"
/** 화면 너비의 이 비율 넘게 밀거나 빠르게 튕기면 넘어간다 */
const DISTANCE_RATIO = 0.22
const FLICK_VELOCITY = 0.45 // px/ms
const SLIDE_MS = 180

interface SwipePagerProps {
  /** 오른쪽으로 밀면 가는 곳(이전 달). 없으면 끝이라 살짝 밀렸다 돌아온다. */
  prevHref: string | null
  /** 왼쪽으로 밀면 가는 곳(다음 달) */
  nextHref: string | null
  children: ReactNode
}

/**
 * 좌우 스와이프로 기간을 넘기는 영역 (가계부 앱처럼).
 * 손가락을 따라 내용이 밀리고, 충분히 밀면 그 방향으로 빠져나간 뒤 이웃 달로 이동한다.
 * 이웃 달은 위쪽 화살표 링크가 미리 받아 두므로(prefetch) 보통 바로 뜬다.
 * 위아래 스크롤은 브라우저가 그대로 처리한다(touch-action: pan-y).
 */
export function SwipePager({ prevHref, nextHref, children }: SwipePagerProps) {
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const gesture = useRef<{
    x: number
    y: number
    t: number
    axis: "x" | "y" | null
    dx: number
  } | null>(null)

  // 넘어온 방향에서 새 내용이 밀려 들어오는 효과
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let direction: string | null = null
    try {
      direction = sessionStorage.getItem(DIRECTION_KEY)
      sessionStorage.removeItem(DIRECTION_KEY)
    } catch {
      direction = null
    }
    if (direction !== "next" && direction !== "prev") return
    el.style.transition = "none"
    el.style.transform = `translateX(${direction === "next" ? 40 : -40}%)`
    el.style.opacity = "0.4"
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = `transform ${SLIDE_MS}ms ease-out, opacity ${SLIDE_MS}ms ease-out`
        el.style.transform = "translateX(0)"
        el.style.opacity = "1"
      })
    })
  }, [prevHref, nextHref])

  function setOffset(dx: number, animate: boolean) {
    const el = ref.current
    if (!el) return
    el.style.transition = animate ? `transform ${SLIDE_MS}ms ease-out` : "none"
    el.style.transform = dx === 0 ? "translateX(0)" : `translateX(${dx}px)`
  }

  function onTouchStart(event: React.TouchEvent) {
    if (event.touches.length !== 1) return
    const touch = event.touches[0]
    gesture.current = { x: touch.clientX, y: touch.clientY, t: Date.now(), axis: null, dx: 0 }
  }

  function onTouchMove(event: React.TouchEvent) {
    const g = gesture.current
    if (!g) return
    const touch = event.touches[0]
    const dx = touch.clientX - g.x
    const dy = touch.clientY - g.y
    if (g.axis === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      g.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y"
    }
    if (g.axis !== "x") return
    const target = dx < 0 ? nextHref : prevHref
    // 더 갈 곳이 없으면 고무줄처럼 조금만 밀린다
    g.dx = target ? dx : dx * 0.25
    setOffset(g.dx, false)
  }

  function onTouchEnd() {
    const g = gesture.current
    gesture.current = null
    if (!g || g.axis !== "x") return
    const width = ref.current?.offsetWidth ?? window.innerWidth
    const velocity = Math.abs(g.dx) / Math.max(Date.now() - g.t, 1)
    const target = g.dx < 0 ? nextHref : prevHref
    const passed = Math.abs(g.dx) > width * DISTANCE_RATIO || velocity > FLICK_VELOCITY

    if (!target || !passed || g.dx === 0) {
      setOffset(0, true)
      return
    }

    const direction = g.dx < 0 ? "next" : "prev"
    setOffset(direction === "next" ? -width : width, true)
    try {
      sessionStorage.setItem(DIRECTION_KEY, direction)
    } catch {
      // 저장소를 못 써도 이동은 된다 (밀려 들어오는 효과만 빠진다)
    }
    window.setTimeout(() => router.push(target), SLIDE_MS)
  }

  return (
    <div
      ref={ref}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        gesture.current = null
        setOffset(0, true)
      }}
      className="flex touch-pan-y flex-col gap-3 will-change-transform"
    >
      {children}
    </div>
  )
}
