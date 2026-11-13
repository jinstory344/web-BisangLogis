/** 매출 목록 왼쪽 출처 칸의 줄들 (SaleSourceCell 참고) */
export function saleSourceLines(sale: {
  source_major: string | null
  source_sub?: string | null
  source_minor: string | null
}): string[] {
  if (sale.source_sub) {
    return sale.source_minor ? [sale.source_sub, sale.source_minor] : [sale.source_sub]
  }
  return [sale.source_minor || sale.source_major || "-"]
}
