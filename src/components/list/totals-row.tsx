import { cn } from "@/lib/utils"

export interface TotalsRowItem {
  label: string
  value: string
  className?: string
  /** 이름 글씨를 따로 키울 때 (지출 목록처럼 칸이 하나뿐일 때) */
  labelClassName?: string
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
  /** lg: HOME·검색의 매출·지출·수익 요약처럼 크게 (이름 13px, 금액 16px) */
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
              large ? "text-[13px] leading-5" : "text-[11px] leading-4",
              item.labelClassName
            )}
          >{item.label}</dt>
          <dd
            className={cn(
              "max-w-full truncate font-medium tabular-nums",
              large ? "text-base leading-6" : "text-sm leading-5",
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
