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
export function TotalsRow({ items }: { items: TotalsRowItem[] }) {
  return (
    <dl
      className="-mx-4 grid border-b px-2 py-1.5 md:mx-0 md:px-0"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col items-center">
          <dt className="text-[11px] leading-4 text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              "max-w-full truncate text-sm leading-5 font-medium tabular-nums",
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
