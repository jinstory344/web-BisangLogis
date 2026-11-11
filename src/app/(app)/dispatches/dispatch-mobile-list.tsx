"use client"

import { Phone } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, type ReactNode } from "react"

import { DayHeader } from "@/components/list/day-header"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { CARGO_BOX_TYPE_LABELS } from "@/lib/constants/cargo-box-type"
import { DROPOFF_TYPE_LABELS } from "@/lib/constants/dropoff-type"
import { formatDateWithWeekday } from "@/lib/date"
import { groupByDay, spansMultipleMonths } from "@/lib/day-groups"
import { formatKRW } from "@/lib/money"
import { formatPhoneNumber } from "@/lib/phone"
import type { DispatchRow } from "@/lib/supabase/database.types"

interface DispatchMobileListProps {
  dispatches: DispatchRow[]
  clientNameMap: Record<string, string>
  /** 거래처 필터에 맞는 전체 건수 (페이지가 아니라 필터 전체 기준) */
  totalCount: number
  /** 거래처 필터가 걸려 있을 때만 목록 위에 그 거래처의 운임·수수료 합계를 보여 준다. */
  filteredTotals: { freightAmount: number; feeAmount: number } | null
  onDelete: (dispatch: DispatchRow) => void
}

function clientNameOf(
  dispatch: DispatchRow,
  clientNameMap: Record<string, string>
): string {
  return dispatch.client_id ? (clientNameMap[dispatch.client_id] ?? "-") : "-"
}

/** 행 둘째 줄: "12가3456 · 김기사" (차량을 아직 정하지 않았으면 "차량 미정") */
function vehicleLine(dispatch: DispatchRow): string {
  const text = [dispatch.plate_no_snapshot, dispatch.driver_name_snapshot]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ")
  return text || "차량 미정"
}

/**
 * 모바일 배차 목록: 날짜별 묶음 + 한 건당 두 줄 행(거래처 · 구간/차량·기사 · 운임/수수료).
 * 행에는 버튼이 없고, 행을 누르면 열리는 작업 시트에서 상세·수정·복사 등록·삭제를 한다.
 * 운임·수수료는 기사에게 지급하는 비용과 중개 수수료 기록이라 매출과 합치지 않는다.
 */
export function DispatchMobileList({
  dispatches,
  clientNameMap,
  totalCount,
  filteredTotals,
  onDelete,
}: DispatchMobileListProps) {
  const groups = useMemo(
    () =>
      groupByDay(
        dispatches,
        (dispatch) => dispatch.dispatch_date,
        (dispatch) => dispatch.freight_amount ?? 0
      ),
    [dispatches]
  )
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const spansMonths = spansMultipleMonths(groups)
  const sheetDispatch =
    dispatches.find((dispatch) => dispatch.id === sheetId) ?? null

  function openSheet(dispatch: DispatchRow) {
    setSheetId(dispatch.id)
    setIsSheetOpen(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex min-h-9 items-center text-xs text-muted-foreground">
        {totalCount}건
        {filteredTotals
          ? ` · 운임 ${formatKRW(filteredTotals.freightAmount)} · 수수료 ${formatKRW(filteredTotals.feeAmount)}`
          : ""}
      </p>

      {groups.map((group) => (
        <section key={group.date} className="overflow-hidden rounded-xl border">
          <DayHeader
            date={group.date}
            totalLabel={`${group.rows.length}건${
              group.total > 0 ? ` · 운임 ${formatKRW(group.total)}` : ""
            }`}
            showMonth={spansMonths}
          />

          {group.rows.map((dispatch) => (
            <div
              key={dispatch.id}
              className="relative flex items-start gap-3 border-t px-4 py-2.5 first:border-t-0"
            >
              {/* 행 전체가 눌리는 영역(누르면 작업 시트). 안쪽 글자는 클릭을 그대로 통과시킨다. */}
              <button
                type="button"
                aria-label={`${dispatch.origin}에서 ${dispatch.destination}`}
                className="absolute inset-0 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/60"
                onClick={() => openSheet(dispatch)}
              />

              <div className="pointer-events-none w-16 shrink-0 pt-0.5 text-xs leading-snug break-keep text-muted-foreground">
                {clientNameOf(dispatch, clientNameMap)}
              </div>

              <div className="pointer-events-none min-w-0 flex-1">
                <p className="leading-snug font-medium break-keep">
                  {dispatch.origin} → {dispatch.destination}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {vehicleLine(dispatch)}
                </p>
              </div>

              <div className="pointer-events-none flex shrink-0 flex-col items-end gap-0.5">
                {dispatch.freight_amount != null ? (
                  <span className="font-semibold tabular-nums">
                    {formatKRW(dispatch.freight_amount)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
                {dispatch.fee_amount > 0 ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    수수료 {formatKRW(dispatch.fee_amount)}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </section>
      ))}

      <Sheet
        open={isSheetOpen && sheetDispatch !== null}
        onOpenChange={setIsSheetOpen}
      >
        <SheetContent side="bottom" className="max-h-[85svh] gap-0 overflow-y-auto pb-6">
          {sheetDispatch ? (
            <DispatchActionSheetBody
              dispatch={sheetDispatch}
              clientName={clientNameOf(sheetDispatch, clientNameMap)}
              onDelete={() => {
                setIsSheetOpen(false)
                onDelete(sheetDispatch)
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function PhoneLink({ phone }: { phone: string }) {
  return (
    <a
      href={`tel:${phone.replace(/[^\d+]/g, "")}`}
      className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
    >
      <Phone className="size-3.5" aria-hidden />
      {formatPhoneNumber(phone)}
    </a>
  )
}

function DispatchActionSheetBody({
  dispatch,
  clientName,
  onDelete,
}: {
  dispatch: DispatchRow
  clientName: string
  onDelete: () => void
}) {
  const contactName = dispatch.contact_name?.trim() ?? ""
  const contactPhone = dispatch.contact_phone?.trim() ?? ""
  const driverName = dispatch.driver_name_snapshot?.trim() ?? ""
  const driverPhone = dispatch.driver_phone_snapshot?.trim() ?? ""
  const plate = dispatch.plate_no_snapshot?.trim() ?? ""

  const cargo = [
    dispatch.cargo_box_type ? CARGO_BOX_TYPE_LABELS[dispatch.cargo_box_type] : "",
    dispatch.pallet_count != null ? `파렛 ${dispatch.pallet_count}` : "",
    dispatch.weight_ton != null ? `${dispatch.weight_ton}톤` : "",
  ]
    .filter(Boolean)
    .join(" · ")

  const details: { label: string; value: ReactNode }[] = [
    {
      label: "담당자",
      value:
        contactName || contactPhone ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {contactName ? <span>{contactName}</span> : null}
            {contactPhone ? <PhoneLink phone={contactPhone} /> : null}
          </span>
        ) : null,
    },
    {
      label: "차량",
      value:
        plate || driverName || driverPhone ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {plate || driverName ? (
              <span>{[plate, driverName].filter(Boolean).join(" · ")}</span>
            ) : null}
            {driverPhone ? <PhoneLink phone={driverPhone} /> : null}
          </span>
        ) : null,
    },
    { label: "하차일", value: DROPOFF_TYPE_LABELS[dispatch.dropoff_type] },
    { label: "화물", value: cargo },
    {
      label: "운임",
      value:
        dispatch.freight_amount != null ? formatKRW(dispatch.freight_amount) : "",
    },
    {
      label: "수수료",
      value: dispatch.fee_amount > 0 ? formatKRW(dispatch.fee_amount) : "",
    },
    { label: "비고", value: dispatch.memo?.trim() ?? "" },
  ].filter((detail) => detail.value)

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle className="leading-snug break-keep">
          {dispatch.origin} → {dispatch.destination}
        </SheetTitle>
        <SheetDescription>
          {formatDateWithWeekday(dispatch.dispatch_date)} · {clientName}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-3 px-4">
        <dl className="flex flex-col gap-1.5 text-sm">
          {details.map((detail) => (
            <div key={detail.label} className="flex gap-3">
              <dt className="w-14 shrink-0 text-muted-foreground">
                {detail.label}
              </dt>
              <dd className="min-w-0 flex-1 break-words whitespace-pre-wrap">
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" className="h-11" asChild>
            <Link href={`/dispatches/${dispatch.id}`}>상세</Link>
          </Button>
          <Button variant="outline" className="h-11" asChild>
            <Link href={`/dispatches/${dispatch.id}/edit`}>수정</Link>
          </Button>
          <Button variant="outline" className="h-11" asChild>
            <Link href={`/dispatches/new?copy=${dispatch.id}`}>복사 등록</Link>
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          className="h-10 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          삭제
        </Button>
      </div>
    </>
  )
}
