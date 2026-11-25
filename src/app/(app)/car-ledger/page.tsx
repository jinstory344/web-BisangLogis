import type { Metadata } from "next"
import Link from "next/link"
import { Settings } from "lucide-react"

import { SearchButton } from "@/components/layout/search-button"
import { PageTitle } from "@/components/layout/page-title"
import { StickyHead } from "@/components/layout/sticky-head"
import { ListPeriodView } from "@/components/list/list-period-view"
import { ListViewTabs } from "@/components/list/list-view-menu"
import { MonthSwipe } from "@/components/list/month-swipe"
import { SummaryMonthPicker } from "@/components/list/summary-month-picker"
import { kindColor, SERVICE_KIND } from "@/lib/car-ledger/constants"
import type { CarRow } from "@/lib/supabase/database.types"
import { buildCycleRows, inRange, itemHistory, kindTotals, serviceItemCounts } from "@/lib/car-ledger/stats"
import { carKindOrder, carTabs, parseCarTab } from "@/lib/car-ledger/tabs"
import { carDayPeriod, carLedgerHref, CYCLE_TAB, firstParam, SERVICE_TAB } from "@/lib/car-ledger/url"
import { getCurrentMonthRangeInSeoul, getTodayInSeoul } from "@/lib/date"
import { formatKRW } from "@/lib/money"
import { AMOUNT_METRIC_KEYS, carMetricRows } from "@/lib/period-metrics"
import {
  getViewRange,
  listAnchor,
  parseListView,
  type ListView,
} from "@/lib/period-view"
import { createClient } from "@/lib/supabase/server"

import { AddButton } from "./add-button"
import { CarCalendar } from "./car-calendar"
import { CostSummary } from "./cost-summary"
import { CycleTable } from "./cycle-table"
import {
  loadCarAmountRows,
  loadCarLedgerData,
  loadCarMasters,
  primaryBusinessCarId,
} from "./data"
import { ItemChips } from "./item-chips"
import { KindTab } from "./kind-tab"
import { ServiceTab } from "./service-tab"
import { TabPanels } from "./tab-panels"

export const metadata: Metadata = {
  title: "차계부 · 비상로지스",
}

type CarLedgerSearchParams = {
  car?: string | string[]
  view?: string | string[]
  from?: string | string[]
  to?: string | string[]
  tab?: string | string[]
  item?: string | string[]
}

/**
 * 차계부: 차 칩 · 이달 차 비용(종류별 막대) · 탭(정비/교체 주기/주유/요소수…).
 * 제목 옆 보기 메뉴로 일일(지금 탭 화면)·달력·주별·월별·연별을 바꾸고, 머리 오른쪽 달력 아이콘으로 달(월별은 해)을 고른다.
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
  const view = parseListView(firstParam(params.view) || undefined)
  const currentMonthFrom = getCurrentMonthRangeInSeoul().from
  // 일일: 그 달(달력 날짜·주별 줄에서 오면 그 달 안의 짧은 기간), 그 밖의 보기: from이 기준일
  const month = carDayPeriod(firstParam(params.from), firstParam(params.to), currentMonthFrom)
  const anchor = listAnchor(firstParam(params.from), firstParam(params.to), currentMonthFrom)
  const periodLabel = month.label
  const supabase = await createClient()
  const masters = await loadCarMasters(supabase)

  const headContent = (
    <>
      <header className="grid h-10 grid-cols-[2.5rem_1fr_2.5rem] items-center">
        <SearchButton />
        <PageTitle title="차계부" barClassName="bg-[#2a95a5]" />
        {/* 다른 화면처럼 오른쪽 끝 달력 아이콘으로 달 고르기 (월별은 해, 연별은 없음). 이전·다음은 쓸어 넘기기 */}
        <SummaryMonthPicker from={month.from} to={month.to} />
      </header>
      <div className="mt-3">
        <ListViewTabs accentClassName="bg-[#2a95a5]" />
      </div>
    </>
  )
  const headClassName = "sticky top-0 z-30 -mx-4 bg-background px-4 pt-6 md:static md:mx-0 md:px-0 md:pt-0"
  // 일일(탭) 화면은 아래 비용 박스·탭 줄 묶음이 높이를 재므로 그냥 고정, 달력 등은 머리 높이를 재서
  // 그날 내역의 날짜 줄이 머리 바로 밑에 붙게 한다
  const head =
    view === "day" ? (
      <div className={headClassName}>{headContent}</div>
    ) : (
      <StickyHead className={headClassName}>{headContent}</StickyHead>
    )

  if (masters.error || masters.cars.length === 0) {
    return (
      <div className="px-4 pb-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {head}
          <p className="py-12 text-center text-sm text-muted-foreground">
            {masters.error ? (
              `차계부를 불러오지 못했어요: ${masters.error}`
            ) : (
              <>
                등록된 차가 없어요.{" "}
                <Link href="/car-ledger/settings" className="underline underline-offset-2">
                  차계부 설정
                </Link>
                에서 차를 추가하세요.
              </>
            )}
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
  // 첫 화면은 내 트럭(업무용). 다른 차는 ⚙ 설정에서 골라 같은 화면으로 연다.
  const defaultCarId = (cars.find((row) => row.kind === "business") ?? cars[0]).id

  if (view !== "day") {
    return (
      <div className="px-4 pb-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {head}
          <CarPeriodBody
            view={view}
            anchor={anchor}
            today={today}
            params={params}
            car={car}
            isDefault={car.id === defaultCarId}
            isExpenseCar={isExpenseCar}
          />
        </div>
      </div>
    )
  }
  const data = await loadCarLedgerData(supabase, car.id, isExpenseCar, month.from.slice(0, 4))

  const kindOrder = carKindOrder(
    car.kind,
    masters.logKinds.map((row) => row.name),
    [...new Set(data.entries.map((entry) => entry.kind))]
  )
  const tabs = carTabs(kindOrder)
  const tab = parseCarTab(firstParam(params.tab), tabs)
  const item = tab === SERVICE_TAB ? firstParam(params.item).trim() : ""

  const monthTotals = kindTotals(data.amountRows, month.from, month.to, kindOrder)
  const serviceEntries = data.entries.filter((entry) => entry.kind === SERVICE_KIND)

  return (
    <div className="px-4 pb-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        {head}

        {car.id === defaultCarId ? null : <BackToTruck />}

        <TabPanels
          tabs={tabs}
          initial={tab}
          before={
            <CostSummary
              carLabel={car.plate_no ? `${car.name} · ${car.plate_no}` : car.name}
              action={<SettingsLink />}
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
              t.value === SERVICE_TAB ? (
                <ServiceTab
                  key={t.value}
                  monthEntries={serviceEntries}
                  month={month}
                  history={item ? itemHistory(serviceEntries, item) : null}
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
                  entries={data.entries.filter((entry) => entry.kind === t.value)}
                  month={month}
                />
              ),
            ])
          )}
          stickyExtras={{
            [SERVICE_TAB]: <ItemChips counts={serviceItemCounts(serviceEntries)} selected={item} />,
          }}
          addButtons={Object.fromEntries(
            tabs.map((t) => [
              t.value,
              <AddButton
                key={t.value}
                carId={car.id}
                mode={isExpenseCar ? "expense" : "log"}
                defaultKind={t.value === SERVICE_TAB || t.value === CYCLE_TAB ? SERVICE_KIND : t.value}
                returnTo={carLedgerHref({ car: car.id, from: month.from, to: month.to, tab: t.value })}
              />,
            ])
          )}
        />
      </div>
    </div>
  )
}

/** 보고 있는 차 이름 줄 + 설정 ⚙. 내 트럭이 아니면 "내 트럭으로" 돌아가기. */
function CarBar({ car, isDefault }: { car: CarRow; isDefault: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <p className="min-w-0 flex-1 truncate text-sm">
        <span className="font-semibold">{car.name}</span>
        {car.plate_no ? <span className="text-muted-foreground"> · {car.plate_no}</span> : null}
      </p>
      {isDefault ? null : (
        <Link href="/car-ledger" className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          내 트럭으로
        </Link>
      )}
      <SettingsLink />
    </div>
  )
}

/** 내 트럭이 아닌 차를 보고 있을 때 돌아가기 */
function BackToTruck() {
  return (
    <Link href="/car-ledger" className="self-start rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
      ‹ 내 트럭으로
    </Link>
  )
}

/** 차계부 설정(차·항목·11월 이전 기록) — 다른 차의 차계부도 여기서 고른다 */
function SettingsLink() {
  return (
    <Link
      href="/car-ledger/settings"
      aria-label="차계부 설정"
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
    >
      <Settings className="size-5" />
    </Link>
  )
}

/**
 * 차계부 달력·주별·월별·연별 보기: 그 차의 비용 줄(날짜·종류·금액)만 읽어 칸별 합계와 비용 집계 카드(종류별 막대·범례)를 만든다.
 * 합계 기준은 일일(탭) 화면의 달 합계와 같다(정비는 SERVICE_LEDGER_START/EDITED_SINCE 규칙, 할부는 회차 줄).
 */
async function CarPeriodBody({
  view,
  anchor,
  today,
  params,
  car,
  isDefault,
  isExpenseCar,
}: {
  view: Exclude<ListView, "day">
  anchor: string
  today: string
  params: CarLedgerSearchParams
  car: CarRow
  isDefault: boolean
  isExpenseCar: boolean
}) {
  const range = getViewRange(view, anchor)
  const supabase = await createClient()
  let rows
  try {
    rows = await loadCarAmountRows(supabase, car.id, isExpenseCar, range.from, range.to)
  } catch (error) {
    return (
      <p className="text-sm text-destructive">
        차계부를 불러오지 못했어요: {error instanceof Error ? error.message : "알 수 없는 오류"}
      </p>
    )
  }

  const current = rows.filter((row) => inRange(row.date, range.from, range.to))

  if (view === "calendar") {
    // 달력: 날짜를 누르면 바로 아래에 그날 내역(처음엔 이번 달이면 오늘) — 다른 화면으로 가지 않는다
    const data = await loadCarLedgerData(supabase, car.id, isExpenseCar, range.from.slice(0, 4))
    const daySums: Record<string, number> = {}
    for (const row of current) daySums[row.date] = (daySums[row.date] ?? 0) + row.amount
    return (
      <>
        <CarBar car={car} isDefault={isDefault} />
        <MonthSwipe className="flex flex-col gap-3">
          <CarCalendar
            anchor={anchor}
            today={today}
            daySums={daySums}
            entries={data.entries.filter((entry) => entry.dates.some((date) => inRange(date, range.from, range.to)))}
          />
        </MonthSwipe>
      </>
    )
  }

  const urlParams = { ...params, view: undefined, tab: undefined, item: undefined }
  return (
    <>
      <CarBar car={car} isDefault={isDefault} />
      <MonthSwipe className="flex flex-col gap-3">
        <ListPeriodView
          view={view}
          anchor={anchor}
          today={today}
          pathname="/car-ledger"
          params={{ ...urlParams, car: car.id }}
          rows={carMetricRows(current)}
          keys={AMOUNT_METRIC_KEYS}
          cellLines={({ sums }) => [{ text: sums.amount.toLocaleString("ko-KR") }]}
          rowView={({ count, sums }) => ({ countText: `${count}건`, value: formatKRW(sums.amount) })}
        />
      </MonthSwipe>
    </>
  )
}
