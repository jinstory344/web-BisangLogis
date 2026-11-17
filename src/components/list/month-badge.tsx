import { cn } from "@/lib/utils"

/** 거르기 줄 왼쪽의 달 배지 ("11월"). 화면별 색: HOME·매출·지출 차분한 빨강(눈부시지 않게), 배차 노랑 */
export function MonthBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "mr-1.5 inline-flex h-6 shrink-0 items-center rounded-full bg-[#c65a55] px-2.5 text-[13px] font-bold text-[#fff3f2]",
        className
      )}
    >
      {label}
    </span>
  )
}
