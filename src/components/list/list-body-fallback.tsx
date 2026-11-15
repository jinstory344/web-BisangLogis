import { LIST_SUB_STICKY_CLASS } from "@/components/list/list-page-head"
import { TotalsRow } from "@/components/list/totals-row"

/**
 * 목록 화면이 데이터를 읽는 동안 보이는 틀: 합계 줄 자리 + 흐린 줄들.
 * 제목·달 이동은 먼저 보내고 이 틀을 보여 준 뒤, 데이터가 오면 바꿔 끼운다(HOME과 같은 스트리밍).
 */
export function ListBodyFallback({ labels }: { labels?: string[] }) {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      {labels ? (
        <div className={LIST_SUB_STICKY_CLASS}>
          <TotalsRow size="lg" items={labels.map((label) => ({ label, value: " " }))} />
        </div>
      ) : null}
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-muted/40" />
      ))}
    </div>
  )
}
