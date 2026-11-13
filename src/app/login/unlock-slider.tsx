"use client"

import { ArrowRight, Loader2 } from "lucide-react"
import { useEffect, useRef, useState, type PointerEvent } from "react"

import { cn } from "@/lib/utils"

/** 끝까지의 이 비율 넘게 밀고 놓으면 연다 */
const UNLOCK_RATIO = 0.85
const KNOB = 48 // px
const PAD = 6 // px

/**
 * 밀어서 여는 로그인 버튼 (Unlock).
 * 동그라미를 오른쪽 끝 가까이까지 밀고 놓으면 onUnlock을 부르고, 아니면 제자리로 돌아간다.
 * pending 동안은 끝에 머물러 돌아가는 표시를 보여 주고, 끝나면(로그인 실패 등) 제자리로 돌아온다.
 * 키보드로는 동그라미에 초점을 두고 Enter/Space로 열 수 있다.
 */
export function UnlockSlider({
  onUnlock,
  pending,
  label = "Unlock",
}: {
  /** false를 돌려주면(입력이 비었을 때 등) 바로 제자리로 돌아간다 */
  onUnlock: () => boolean
  pending: boolean
  label?: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<{ pointerX: number; knobX: number } | null>(null)
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)

  function maxX() {
    const width = trackRef.current?.clientWidth ?? 0
    return Math.max(0, width - KNOB - PAD * 2)
  }

  // 로그인 시도가 끝났는데 아직 이 화면이면(실패) 제자리로
  useEffect(() => {
    if (!pending) setX(0)
  }, [pending])

  function unlock() {
    setX(maxX())
    if (!onUnlock()) setX(0)
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (pending) return
    event.currentTarget.setPointerCapture(event.pointerId)
    startRef.current = { pointerX: event.clientX, knobX: x }
    setDragging(true)
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const start = startRef.current
    if (!start) return
    const next = start.knobX + (event.clientX - start.pointerX)
    setX(Math.min(maxX(), Math.max(0, next)))
  }

  function handlePointerUp() {
    if (!startRef.current) return
    startRef.current = null
    setDragging(false)
    const max = maxX()
    if (max > 0 && x >= max * UNLOCK_RATIO) unlock()
    else setX(0)
  }

  const max = maxX()
  const progress = max > 0 ? x / max : 0

  return (
    <div
      ref={trackRef}
      className="relative flex h-[60px] items-center rounded-full border border-white/12 bg-white/[0.07] select-none"
      style={{ padding: PAD }}
    >
      {/* 지나온 길이 은은하게 차오름 */}
      <div
        aria-hidden
        className="absolute inset-y-[6px] left-[6px] rounded-full bg-gradient-to-r from-blue-500/0 to-blue-500/35"
        style={{ width: x + KNOB }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 left-14 flex items-center justify-center gap-2 text-[17px] font-semibold tracking-[0.08em] text-slate-200"
        style={{ opacity: pending ? 0 : 1 - progress * 1.4 }}
      >
        {label}
        <span className="font-normal tracking-normal text-slate-500">›››</span>
      </span>
      <button
        type="button"
        aria-label="밀어서 로그인"
        disabled={pending}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            unlock()
          }
        }}
        className={cn(
          "relative z-10 flex touch-none items-center justify-center rounded-full bg-gradient-to-br from-[#2558c9] to-[#3b82f6] text-white shadow-[0_6px_18px_rgba(59,130,246,0.5)] outline-none focus-visible:ring-2 focus-visible:ring-blue-300",
          !dragging && "transition-transform duration-300 ease-out"
        )}
        style={{ width: KNOB, height: KNOB, transform: `translateX(${x}px)` }}
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <ArrowRight className="size-5" />
        )}
      </button>
    </div>
  )
}
