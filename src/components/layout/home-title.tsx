"use client"

import { useEffect, useState } from "react"

import { LiveClock } from "@/components/layout/live-clock"
import { sloganFont } from "@/lib/fonts"
import { cn } from "@/lib/utils"

/** 문구와 시계가 각각 보이는 시간(ms) */
const SWITCH_MS = 5000

/**
 * HOME 제목: "Beyond your dream!" 문구와 실시간 시계가 5초마다 부드럽게 번갈아 나온다.
 * 둘을 같은 칸에 겹쳐 두고 투명도만 바꿔서, 바뀔 때 제목 줄이 들썩이지 않는다.
 */
export function HomeTitle() {
  const [showClock, setShowClock] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setShowClock((v) => !v), SWITCH_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <span className="grid place-items-center">
      <span
        aria-hidden={showClock}
        className={cn(
          sloganFont.className,
          "col-start-1 row-start-1 text-[24px] font-normal whitespace-nowrap transition-opacity duration-700",
          showClock ? "opacity-0" : "opacity-100"
        )}
      >
        Beyond your dream!
      </span>
      <span
        aria-hidden={!showClock}
        className={cn(
          "col-start-1 row-start-1 whitespace-nowrap transition-opacity duration-700",
          showClock ? "opacity-100" : "opacity-0"
        )}
      >
        <LiveClock />
      </span>
    </span>
  )
}
