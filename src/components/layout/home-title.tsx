import { sloganFont } from "@/lib/fonts"
import { cn } from "@/lib/utils"

/** HOME 제목 문구 "Beyond your dream!" (기울어진 스포티한 글꼴) */
export function HomeTitle() {
  return (
    <span className={cn(sloganFont.className, "text-[24px] font-normal whitespace-nowrap")}>
      Beyond your dream!
    </span>
  )
}
