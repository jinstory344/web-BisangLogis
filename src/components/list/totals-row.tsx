import { cn } from "@/lib/utils"

export interface TotalsRowItem {
  label: string
  value: string
  className?: string
}

/**
 * 고정 영역 아래쪽의 합계 한 줄 (가계부 앱의 수입·지출·이체 줄처럼):
 * 칸마다 이름(아주 작게)과 금액. 화면 폭을 꽉 채우고 아래에 얇은 선.
 */
export function TotalsRow({
  items,
  size = "md",
}: {
  items: TotalsRowItem[]
  /**
   * lg: 앱 공통 요약 크기 (이름 14px, 금액 18px) — HOME·검색·매출·지출·배차 목록 모두 같다.
   * 강조할 금액(수익, 지출 합계)은 항목 className에 굵게를 더한다.
   */
  size?: "md" | "lg"
}) {
  const large = size === "lg"
  return (
    <dl
      className={cn(
        "-mx-4 grid border-b px-2 md:mx-0 md:px-0",
        large ? "py-2" : "py-1.5"
      )}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col items-center">
          <dt
            className={cn(
              "text-muted-foreground",
              large ? "text-sm leading-5" : "text-[11px] leading-4"
            )}
          >{item.label}</dt>
          <dd
            className={cn(
              "max-w-full truncate font-medium tabular-nums",
              large ? "text-lg leading-7" : "text-sm leading-5",
              item.className
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
