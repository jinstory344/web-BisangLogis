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
}: {
  title: ReactNode
  barClassName?: string
  className?: string
}) {
  return (
    <h1 className={cn("flex flex-col items-center text-xl leading-6 font-bold tracking-tight", className)}>
      <span className="inline-flex flex-col items-center gap-1">
        {title}
        {barClassName ? (
          <span aria-hidden className={cn("h-[3px] w-6 rounded-full", barClassName)} />
        ) : null}
      </span>
    </h1>
  )
}
