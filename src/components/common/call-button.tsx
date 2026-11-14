import { Phone } from "lucide-react"

import { cn } from "@/lib/utils"

/** 전화 걸기: 연한 초록 둥근 네모 안의 전화기 (앱 전체 공통, 32px) */
export function CallButton({
  phone,
  label = "전화 걸기",
  className,
}: {
  phone: string
  /** 읽어 주는 이름 (예: "김철수에게 전화") */
  label?: string
  className?: string
}) {
  return (
    <a
      href={`tel:${phone.replace(/[^\d+]/g, "")}`}
      aria-label={label}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-green-500/15 text-green-400 active:bg-green-500/25",
        className
      )}
    >
      <Phone className="size-4" aria-hidden />
    </a>
  )
}
