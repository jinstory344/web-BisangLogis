import { saleSourceLines } from "@/lib/sale-source-lines"

/**
 * 매출 목록 맨 왼쪽 출처 칸.
 * 하위분류가 있으면(예: 카카오톡 › 스마일) 두 줄로: 위에 하위분류, 아래에 오더자.
 *   스마일
 *   김재천
 * 없으면 지금처럼 오더자(없으면 대분류) 한 줄.
 */
export function SaleSourceCell({
  sale,
}: {
  sale: Parameters<typeof saleSourceLines>[0]
}) {
  return (
    <>
      {saleSourceLines(sale).map((line, i) => (
        <span key={i} className="block truncate">
          {line}
        </span>
      ))}
    </>
  )
}
