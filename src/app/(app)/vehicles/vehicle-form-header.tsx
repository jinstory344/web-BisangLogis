import { ChevronLeft, X } from "lucide-react"
import Link from "next/link"

/** 차량 등록·수정 화면 머리: 매출·지출 등록 화면과 같은 모양 (‹ 차량 정보 · 제목 · ✕) */
export function VehicleFormHeader({ title }: { title: string }) {
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center">
      <Link
        href="/vehicles"
        className="-ml-2 flex h-12 w-fit items-center gap-0.5 pr-3 text-base font-medium text-foreground/80"
      >
        <ChevronLeft className="size-6" />
        차량 정보
      </Link>
      <h1 className="text-lg font-semibold">{title}</h1>
      <Link
        href="/vehicles"
        aria-label="닫기"
        className="-mr-2 flex size-12 items-center justify-center justify-self-end text-foreground/80"
      >
        <X className="size-6" />
      </Link>
    </header>
  )
}
