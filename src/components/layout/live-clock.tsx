"use client"

import { useEffect, useState } from "react"

import { formatSeoulClock } from "@/lib/clock"

/** HOME 제목 자리의 실시간 시계 (1초마다). 화면에 뜨기 전에는 자리만 잡아 둔다. */
export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return <span className="tabular-nums">{now ? formatSeoulClock(now) : " "}</span>
}
