"use client"

import { useId } from "react"

import type { RecentRoute } from "@/lib/quick-entry"
import { cn } from "@/lib/utils"

import { chipVariants } from "./choice-chips"

interface RecentRouteChipsProps {
  routes: readonly RecentRoute[]
  /** 현재 입력된 상차지/하차지 — 같은 조합의 칩을 선택 상태로 보여준다. */
  origin: string
  destination: string
  onSelect: (route: RecentRoute) => void
  /** 칩 줄 이름 (기본 "최근 구간", 배차는 "반복 구간") */
  label?: string
}

/**
 * 새 등록·복사 등록 화면의 "최근 구간" 칩. 누르면 상차지·하차지를 한 번에 채운다.
 * 모바일은 한 줄 가로 스크롤(폼 길이를 늘리지 않도록, 화면 가장자리까지), md 이상은 줄바꿈.
 * 최근 구간이 없으면 아무것도 그리지 않는다.
 */
export function RecentRouteChips({
  routes,
  origin,
  destination,
  onSelect,
  label = "최근 구간",
}: RecentRouteChipsProps) {
  const labelId = useId()

  if (routes.length === 0) return null

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={labelId} className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        // contain:inline-size — 가로 스크롤 줄의 칩 너비 합이 바깥 레이아웃(앱 셸의 flex 항목)의
        // 최소 너비로 번져 화면 전체가 가로로 넓어지는 것을 막는다.
        className="no-scrollbar -mx-4 -my-1 flex gap-2 overflow-x-auto px-4 py-1 [contain:inline-size] md:mx-0 md:my-0 md:flex-wrap md:overflow-visible md:px-0 md:py-0 md:[contain:none]"
      >
        {routes.map((route) => {
          const isActive =
            route.origin === origin.trim() &&
            route.destination === destination.trim()

          return (
            <button
              key={`${route.origin}\u0000${route.destination}`}
              type="button"
              aria-pressed={isActive}
              className={cn(chipVariants({ selected: isActive }), "max-w-[16rem]")}
              onClick={() => onSelect(route)}
            >
              <span className="truncate">
                {route.origin} → {route.destination}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
