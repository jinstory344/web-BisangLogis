import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * 모바일 머리 가운데 제목 + 밑에 짧은 색 줄 (HOME 빨강, 배차 노랑, 차량 파랑, 거래처 초록).
 * barClassName이 없으면 줄 없이 제목만.
 */
export function PageTitle({
  title,
  barClassName,
  className,
  fullBar = false,
}: {
  title: ReactNode
  barClassName?: string
  className?: string
  /** 줄을 짧게(24px) 대신 제목 글자 폭만큼 (HOME 시계처럼 글자 폭이 바뀌면 같이 늘고 준다) */
  fullBar?: boolean
}) {
  return (
    <h1 className={cn("flex flex-col items-center text-xl leading-6 font-bold tracking-tight", className)}>
      {/* 글자 폭에 맞춘 상자: fullBar면 줄이 이 상자 폭을 꽉 채운다 */}
      <span className="inline-flex flex-col items-center gap-1">
        {title}
        {barClassName ? (
          <span aria-hidden className={cn("h-[3px] rounded-full", fullBar ? "w-full" : "w-6", barClassName)} />
        ) : null}
      </span>
    </h1>
  )
}
