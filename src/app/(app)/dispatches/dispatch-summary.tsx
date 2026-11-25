import { DonutChart } from "@/components/stats/donut-chart"
import { formatYearMonth, getMonthRange, shiftMonthRange } from "@/lib/date"
import {
  summarizeDispatchMonth,
  UNSET_VEHICLE_LABEL,
} from "@/lib/dispatch-summary"
import { formatKRW } from "@/lib/money"
import { formatChangeRate, percentOf, SUMMARY_TITLE_CLASS, type SummaryComparison } from "@/lib/summary"
import { createClient } from "@/lib/supabase/server"

export interface DispatchSummaryRow {
  client_id: string | null
  plate_no_snapshot: string | null
  driver_name_snapshot: string | null
  freight_amount: number | null
  fee_amount: number
}

/** 배차 집계의 비교 기간: 건수와 운임 */
export interface DispatchComparison extends SummaryComparison {
  count: number
}

/**
 * 배차 월간 집계 탭: 목록 탭에서 보고 있는 달(from이 속한 달)의 배차를
 * 건수 · 운임 · 수수료 합계, 전월 대비, 거래처별, 차량별(기사 이름 + 차량번호)로 보여 준다.
 * 운임·수수료는 기사에게 지급하는 비용과 중개 수수료 기록이라 매출과 합치지 않는다.
 */
export async function DispatchSummary({ from }: { from: string }) {
  const supabase = await createClient()
  const month = getMonthRange(from)
  const previous = shiftMonthRange(from, -1)

  const [{ data: currentRows, error: currentError }, { data: previousRows }] =
    await Promise.all([
      supabase
        .from("dispatches")
        .select(
          "client_id, plate_no_snapshot, driver_name_snapshot, freight_amount, fee_amount"
        )
        .is("deleted_at", null)
        .gte("dispatch_date", month.from)
        .lte("dispatch_date", month.to),
      supabase
        .from("dispatches")
        .select("freight_amount")
        .is("deleted_at", null)
        .gte("dispatch_date", previous.from)
        .lte("dispatch_date", previous.to),
    ])

  if (currentError) {
    return (
      <p className="text-sm text-destructive">
        월간 집계를 불러오지 못했습니다: {currentError.message}
      </p>
    )
  }

  const rows = currentRows ?? []
  const clientIds = [...new Set(rows.map((row) => row.client_id).filter((id): id is string => !!id))]
  let clientNames: Record<string, string> = {}
  if (clientIds.length > 0) {
    const { data: clientRows } = await supabase
      .from("clients")
      .select("id, name")
      .in("id", clientIds)
    clientNames = Object.fromEntries((clientRows ?? []).map((c) => [c.id, c.name]))
  }

  return (
    <DispatchSummaryCard
      title={formatYearMonth(month.from)}
      rows={rows}
      clientNames={clientNames}
      previous={{
        label: "지난 달",
        rateWord: "전월",
        count: previousRows?.length ?? 0,
        total: (previousRows ?? []).reduce((sum, row) => sum + (row.freight_amount ?? 0), 0),
      }}
    />
  )
}

/**
 * 배차 집계 카드(통계 화면·배차 달력/월별/연별 보기): 건수 · 운임 · 수수료 · 비교 · 거래처별 도넛 · 거래처별·차량별 목록.
 */
export function DispatchSummaryCard({
  title,
  rows,
  clientNames,
  previous,
}: {
  /** "2026년 11월" / "2026년" / "전체 기간" */
  title: string
  rows: readonly DispatchSummaryRow[]
  /** 거래처 id → 이름 */
  clientNames: Record<string, string>
  previous: DispatchComparison | null
}) {
  const summary = summarizeDispatchMonth(rows)
  const previousFreight = previous?.total ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border p-4">
        <p className={SUMMARY_TITLE_CLASS}>{title} 배차</p>
        <p className="text-2xl font-semibold tabular-nums">{summary.count}건</p>
        <p className="mt-1 text-sm tabular-nums">
          운임 {formatKRW(summary.freightAmount)}
          <span className="text-muted-foreground">
            {" "}
            · 수수료 {formatKRW(summary.feeAmount)}
          </span>
        </p>
        {previous ? (
          <p className="text-sm text-muted-foreground">
            {formatChangeRate(summary.freightAmount, previousFreight, "운임", previous.rateWord)} (
            {previous.label} {previous.count}건 · 운임 {formatKRW(previousFreight)})
          </p>
        ) : null}
      </div>

      <DonutChart
        ariaLabel="배차 거래처별 운임 비율"
        items={summary.byClient.map((client) => ({
          label: clientNames[client.clientId] ?? "-",
          value: client.freightAmount,
        }))}
      />

      {summary.count === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          이 기간에 등록된 배차가 없습니다.
        </p>
      ) : (
        <>
          <SummaryGroup title="거래처별">
            {summary.byClient.map((client) => (
              <SummaryRow
                key={client.clientId}
                name={clientNames[client.clientId] ?? "-"}
                count={client.count}
                freightAmount={client.freightAmount}
                feeAmount={client.feeAmount}
                totalFreight={summary.freightAmount}
              />
            ))}
          </SummaryGroup>

          <SummaryGroup title="차량별">
            {summary.byVehicle.map((vehicle) => (
              <SummaryRow
                key={`${vehicle.plate}|${vehicle.driver}`}
                // 기사 이름 뒤에 차량번호를 붙인다 (이름이 없으면 차량번호만, 둘 다 없으면 "차량 미정").
                name={vehicle.driver || vehicle.plate || UNSET_VEHICLE_LABEL}
                detail={vehicle.driver ? vehicle.plate : ""}
                count={vehicle.count}
                freightAmount={vehicle.freightAmount}
                feeAmount={vehicle.feeAmount}
                totalFreight={summary.freightAmount}
              />
            ))}
          </SummaryGroup>
        </>
      )}
    </div>
  )
}

function SummaryGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-md border">
      <p className="border-b p-3 text-sm font-medium text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  )
}

function SummaryRow({
  name,
  detail = "",
  count,
  freightAmount,
  feeAmount,
  totalFreight,
}: {
  name: string
  /** 이름 뒤에 작게 붙이는 보조 글자 (차량별의 차량번호) */
  detail?: string
  count: number
  freightAmount: number
  feeAmount: number
  totalFreight: number
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b p-3 last:border-0">
      <span className="min-w-0 font-medium">
        {name}
        {detail ? (
          <span className="text-sm font-normal text-muted-foreground">
            {" "}
            {detail}
          </span>
        ) : null}{" "}
        <span className="text-sm font-normal text-muted-foreground">{count}건</span>
      </span>
      <span className="shrink-0 text-right tabular-nums">
        {formatKRW(freightAmount)}{" "}
        <span className="text-sm text-muted-foreground">
          ({percentOf(freightAmount, totalFreight)}%)
        </span>
        {feeAmount > 0 ? (
          <span className="block text-xs text-muted-foreground">
            수수료 {formatKRW(feeAmount)}
          </span>
        ) : null}
      </span>
    </div>
  )
}
