import { SummaryMonthNav } from "@/components/list/summary-month-nav"
import { formatYearMonth, getMonthRange, shiftMonthRange } from "@/lib/date"
import { summarizeDispatchMonth } from "@/lib/dispatch-summary"
import { formatKRW } from "@/lib/money"
import { formatChangeRate, percentOf } from "@/lib/summary"
import { createClient } from "@/lib/supabase/server"

/**
 * 배차 월간 집계 탭: 목록 탭에서 보고 있는 달(from이 속한 달)의 배차를
 * 건수 · 운임 · 수수료 합계, 전월 대비, 거래처별, 기사별로 보여 준다.
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
        .select("client_id, driver_name_snapshot, freight_amount, fee_amount")
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

  const summary = summarizeDispatchMonth(currentRows ?? [])
  const previousCount = previousRows?.length ?? 0
  const previousFreight = (previousRows ?? []).reduce(
    (sum, row) => sum + (row.freight_amount ?? 0),
    0
  )

  const clientIds = summary.byClient.map((c) => c.clientId)
  let clientNames: Record<string, string> = {}
  if (clientIds.length > 0) {
    const { data: clientRows } = await supabase
      .from("clients")
      .select("id, name")
      .in("id", clientIds)
    clientNames = Object.fromEntries((clientRows ?? []).map((c) => [c.id, c.name]))
  }

  return (
    <div className="flex flex-col gap-4">
      <SummaryMonthNav from={month.from} to={month.to} />

      <div className="rounded-md border p-4">
        <p className="text-sm text-muted-foreground">
          {formatYearMonth(month.from)} 배차
        </p>
        <p className="text-2xl font-semibold tabular-nums">{summary.count}건</p>
        <p className="mt-1 text-sm tabular-nums">
          운임 {formatKRW(summary.freightAmount)}
          <span className="text-muted-foreground">
            {" "}
            · 수수료 {formatKRW(summary.feeAmount)}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          {formatChangeRate(summary.freightAmount, previousFreight, "운임")} (지난 달{" "}
          {previousCount}건 · 운임 {formatKRW(previousFreight)})
        </p>
      </div>

      {summary.count === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          이 달에 등록된 배차가 없습니다.
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

          <SummaryGroup title="기사별">
            {summary.byDriver.map((driver) => (
              <SummaryRow
                key={driver.driver}
                name={driver.driver}
                count={driver.count}
                freightAmount={driver.freightAmount}
                feeAmount={driver.feeAmount}
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
  count,
  freightAmount,
  feeAmount,
  totalFreight,
}: {
  name: string
  count: number
  freightAmount: number
  feeAmount: number
  totalFreight: number
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b p-3 last:border-0">
      <span className="min-w-0 font-medium">
        {name}{" "}
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
