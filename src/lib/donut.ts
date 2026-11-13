/** 통계 도넛 그래프 조각 색 (큰 조각부터 차례로). 마지막 "그 외"는 회색. */
export const DONUT_COLORS = [
  "#ef6f5e", // 산호
  "#f29b54", // 주황
  "#f2c94c", // 노랑
  "#a6cf4f", // 연두
  "#4fbf8a", // 초록
  "#4fb3c9", // 청록
] as const
export const DONUT_OTHER_COLOR = "#9ca3af"
export const DONUT_OTHER_LABEL = "그 외"

export interface DonutItem {
  label: string
  value: number
}

export interface DonutSegment extends DonutItem {
  color: string
  /** 전체에서 차지하는 비율 0~1 */
  ratio: number
  /** 시작 각도(0 = 12시, 시계 방향, 0~1 한 바퀴 기준) */
  start: number
}

/**
 * 도넛 조각을 만든다: 0 이하는 빼고 큰 순서로, 조각이 너무 많으면 maxSlices − 1개까지만 따로 두고
 * 나머지를 "그 외" 한 조각으로 묶는다. 합계가 0이면 빈 배열.
 */
export function buildDonutSegments(
  items: readonly DonutItem[],
  maxSlices: number = DONUT_COLORS.length
): DonutSegment[] {
  const positive = items.filter((item) => item.value > 0)
  const total = positive.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0) return []

  const sorted = [...positive].sort((a, b) => b.value - a.value)
  let shown: DonutItem[] = sorted
  if (sorted.length > maxSlices) {
    const head = sorted.slice(0, maxSlices - 1)
    const rest = sorted.slice(maxSlices - 1).reduce((sum, item) => sum + item.value, 0)
    shown = [...head, { label: DONUT_OTHER_LABEL, value: rest }]
  }

  let start = 0
  return shown.map((item, index) => {
    const ratio = item.value / total
    const isOther = item.label === DONUT_OTHER_LABEL && index === shown.length - 1 && shown !== sorted
    const segment: DonutSegment = {
      ...item,
      ratio,
      start,
      color: isOther ? DONUT_OTHER_COLOR : DONUT_COLORS[index % DONUT_COLORS.length],
    }
    start += ratio
    return segment
  })
}

/** 목록 줄 앞의 색 점: 그래프에 따로 그린 항목이면 그 색, "그 외"로 묶였으면 회색 */
export function donutColorOf(segments: readonly DonutSegment[], label: string): string {
  return segments.find((s) => s.label === label)?.color ?? DONUT_OTHER_COLOR
}
