import { buildDonutSegments, type DonutItem } from "@/lib/donut"

const RADIUS = 40
const STROKE = 18
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function percentText(ratio: number): string {
  const value = ratio * 100
  return value >= 10 || value === 0 ? `${Math.round(value)}%` : `${value.toFixed(1)}%`
}

/**
 * 통계 합계 아래의 도넛 그래프: 큰 항목부터 색 조각으로, 옆에 이름과 비율을 적는다.
 * 가운데에는 가장 큰 항목의 이름과 비율. 조각이 많으면 작은 것들은 "그 외"로 묶는다.
 */
export function DonutChart({
  items,
  ariaLabel,
}: {
  items: readonly DonutItem[]
  ariaLabel: string
}) {
  const segments = buildDonutSegments(items)
  if (segments.length === 0) return null
  const top = segments[0]

  return (
    <div className="flex items-center gap-4 rounded-md border p-4">
      <svg
        viewBox="0 0 100 100"
        className="size-32 shrink-0"
        role="img"
        aria-label={`${ariaLabel}: ${segments
          .map((s) => `${s.label} ${percentText(s.ratio)}`)
          .join(", ")}`}
      >
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-muted"
        />
        {segments.map((segment) => (
          <circle
            key={`${segment.label}-${segment.start}`}
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke={segment.color}
            strokeWidth={STROKE}
            strokeDasharray={`${segment.ratio * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={-segment.start * CIRCUMFERENCE}
            transform="rotate(-90 50 50)"
          />
        ))}
        <text
          x="50"
          y="46"
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 9 }}
        >
          {top.label.length > 6 ? `${top.label.slice(0, 6)}…` : top.label}
        </text>
        <text
          x="50"
          y="60"
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          {percentText(top.ratio)}
        </text>
      </svg>

      <ul className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
        {segments.map((segment) => (
          <li key={`${segment.label}-${segment.start}`} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span className="min-w-0 flex-1 truncate">{segment.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {percentText(segment.ratio)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
