import { ChevronLeft, X } from "lucide-react"
import Link from "next/link"

/** 등록·수정 화면 머리: 매출·지출 등록 화면과 같은 모양 (‹ 돌아갈 곳 · 제목 · ✕) */
export function FormPageHeader({
  title,
  backHref,
  backLabel,
}: {
  title: string
  backHref: string
  backLabel: string
}) {
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center">
      <Link
        href={backHref}
        className="-ml-2 flex h-12 w-fit items-center gap-0.5 pr-3 text-base font-medium text-foreground/80"
      >
        <ChevronLeft className="size-6" />
        {backLabel}
      </Link>
      <h1 className="text-lg font-semibold">{title}</h1>
      <Link
        href={backHref}
        aria-label="닫기"
        className="-mr-2 flex size-12 items-center justify-center justify-self-end text-foreground/80"
      >
        <X className="size-6" />
      </Link>
    </header>
  )
}
