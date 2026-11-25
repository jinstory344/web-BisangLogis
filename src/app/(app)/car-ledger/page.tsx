import type { Metadata } from "next"
import Link from "next/link"
import { Settings } from "lucide-react"

import { SearchButton } from "@/components/layout/search-button"
import { PageTitle } from "@/components/layout/page-title"
import { SummaryMonthNav } from "@/components/list/summary-month-nav"
import { isLiterKind, kindColor, SERVICE_KIND } from "@/lib/car-ledger/constants"
import { buildCycleRows, inRange, itemHistory, kindTotals, serviceItemCounts } from "@/lib/car-ledger/stats"
import { carKindOrder, carTabs, parseCarTab } from "@/lib/car-ledger/tabs"
import { carLedgerHref, CYCLE_TAB, firstParam, HISTORY_TAB, SERVICE_TAB } from "@/lib/car-ledger/url"
import { getCurrentMonthRangeInSeoul, getMonthRange, getTodayInSeoul } from "@/lib/date"
import { parseAnchorDate } from "@/lib/ledger"
import { createClient } from "@/lib/supabase/server"

import { AddButton } from "./add-button"
import { CarChips } from "./car-chips"
import { CostSummary } from "./cost-summary"
import { CycleTable } from "./cycle-table"
import { loadCarLedgerData, loadCarMasters, loadServiceHistory, primaryBusinessCarId } from "./data"
import { HistoryTab } from "./history-tab"
import { KindTab } from "./kind-tab"
import { ServiceTab } from "./service-tab"
import { TabPanels } from "./tab-panels"

export const metadata: Metadata = {
  title: "차계부 · 비상로지스",
}

type CarLedgerSearchParams = {
  car?: string | string[]
  from?: string | string[]
  to?: string | string[]
  tab?: string | string[]
  item?: string | string[]
}

/**
 * 차계부: 차 칩 · 달 이동(해 전체 보기 가능) · 이달 차 비용(종류별 막대) · 탭(정비/교체 주기/주유/요소수…).
 * 업무용 트럭은 지출(차량 › 정비·주유비·요소수)을 그대로 가져와 보여 주고(다시 입력하지 않음),
 * 승용차 등은 차계부에만 저장한 기록(car_logs)을 보여 준다.
 */
export default async function CarLedgerPage({
  searchParams,
}: {
  searchParams: Promise<CarLedgerSearchParams>
}) {
  const params = await searchParams
  const today = getTodayInSeoul()
  const anchor = parseAnchorDate(firstParam(params.from), getCurrentMonthRangeInSeoul().from)
  // 달 고르기 창에서 "2026년 전체"를 누르면 from=1/1, to=12/31 — 1년치 보기
  const isYearView = anchor.slice(5) === "01-01" && firstParam(params.to) === `${anchor.slice(0, 4)}-12-31`
  const month = isYearView ? { from: anchor, to: `${anchor.slice(0, 4)}-12-31` } : getMonthRange(anchor)
  const periodLabel = isYearView ? `${anchor.slice(0, 4)}년` : `${Number(month.from.slice(5, 7))}월`
  const supabase = await createClient()
  const masters = await loadCarMasters(supabase)

  const head = (
    <div className="sticky top-0 z-30 -mx-4 bg-background px-4 pt-6 md:static md:mx-0 md:px-0 md:pt-0">
      <header className="grid h-10 grid-cols-[2.5rem_1fr_2.5rem] items-center">
        <SearchButton />
        <PageTitle title="차계부" barClassName="bg-[#9b7fd1]" />
        <Link
          href="/car-ledger/settings"
          aria-label="차계부 설정"
          className="flex size-10 items-center justify-center justify-self-end rounded-full text-muted-foreground hover:bg-muted"
        >
          <Settings className="size-5" />
        </Link>
      </header>
    </div>
  )

  if (masters.error || masters.cars.length === 0) {
    return (
      <div className="px-4 pb-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {head}
          <p className="py-12 text-center text-sm text-muted-foreground">
            {masters.error
              ? `차계부를 불러오지 못했어요: ${masters.error}`
              : "등록된 차가 없어요. 오른쪽 위 ⚙에서 차를 추가하세요."}
          </p>
        </div>
      </div>
    )
  }

  const { cars } = masters
  const requestedCar = firstParam(params.car)
  const car =
    cars.find((row) => row.id === requestedCar) ?? cars.find((row) => row.kind === "business") ?? cars[0]
  const isExpenseCar = car.id === primaryBusinessCarId(cars)
  const [data, history] = await Promise.all([
    loadCarLedgerData(supabase, car.id, isExpenseCar, month.from.slice(0, 4)),
    loadServiceHistory(supabase, car.id),
  ])

  const kindOrder = carKindOrder(
    car.kind,
    masters.logKinds.map((row) => row.name),
    [...new Set(data.entries.map((entry) => entry.kind))]
  )
  const tabs = carTabs(kindOrder, history.length > 0)
  const tab = parseCarTab(firstParam(params.tab), tabs)
  const item = tab === SERVICE_TAB ? firstParam(params.item).trim() : ""

  const monthTotals = kindTotals(data.amountRows, month.from, month.to, kindOrder)
  const serviceEntries = data.entries.filter((entry) => entry.kind === SERVICE_KIND)

  return (
    <div className="px-4 pb-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        {head}

        <CarChips cars={cars} selectedId={car.id} from={month.from} to={month.to} />

        <SummaryMonthNav from={month.from} to={month.to} allowYear />

        <TabPanels
          tabs={tabs}
          initial={tab}
          before={
            <CostSummary
              monthLabel={periodLabel}
              total={monthTotals.total}
              byKind={monthTotals.byKind.map((row) => ({
                ...row,
                color: kindColor(kindOrder.indexOf(row.kind)),
              }))}
            />
          }
          panels={Object.fromEntries(
            tabs.map((t) => [
              t.value,
              t.value === HISTORY_TAB ? (
                <HistoryTab key={t.value} rows={history} />
              ) : t.value === SERVICE_TAB ? (
                <ServiceTab
                  key={t.value}
                  monthEntries={serviceEntries.filter((entry) => entry.dates.some((date) => inRange(date, month.from, month.to)))}
                  counts={serviceItemCounts(serviceEntries)}
                  history={item ? itemHistory(serviceEntries, item) : null}
                  today={today}
                />
              ) : t.value === CYCLE_TAB ? (
                <CycleTable
                  key={t.value}
                  carId={car.id}
                  rows={buildCycleRows(data.cycles, serviceEntries)}
                  itemNames={masters.serviceItems.map((row) => row.name)}
                  today={today}
                />
              ) : (
                <KindTab
                  key={t.value}
                  kind={t.value}
                  entries={data.entries.filter(
                    (entry) => entry.kind === t.value && inRange(entry.date, month.from, month.to)
                  )}
                  month={month}
                  periodLabel={periodLabel}
                  showLiters={isLiterKind(t.value)}
                  today={today}
                />
              ),
            ])
          )}
          addButtons={Object.fromEntries(
            tabs.map((t) => [
              t.value,
              <AddButton
                key={t.value}
                carId={car.id}
                mode={isExpenseCar ? "expense" : "log"}
                defaultKind={t.value === SERVICE_TAB || t.value === CYCLE_TAB || t.value === HISTORY_TAB ? SERVICE_KIND : t.value}
                returnTo={carLedgerHref({ car: car.id, from: month.from, to: month.to, tab: t.value })}
              />,
            ])
          )}
        />
      </div>
    </div>
  )
}
