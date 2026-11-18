"use client"

import Link from "next/link"
import { useMemo, useState, type ReactNode } from "react"

import { ReturnToLink } from "@/components/common/return-to-link"
import { DayHeader } from "@/components/list/day-header"
import { ContactRow } from "@/components/common/contact-row"

import { DispatchMessageSheet, type MessageTarget } from "./message-sheets"
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
import { Building2, Truck } from "lucide-react"
import type { DispatchRow } from "@/lib/supabase/database.types"

interface DispatchMobileListProps {
  dispatches: DispatchRow[]
  clientNameMap: Record<string, string>
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

/** 행 둘째 줄: 차주 이름(흰색, 조금 크게) · 차량번호 (차량을 아직 정하지 않았으면 "차량 미정") */
function VehicleLine({ dispatch }: { dispatch: DispatchRow }) {
  const name = dispatch.driver_name_snapshot?.trim()
  const plate = dispatch.plate_no_snapshot?.trim()
  if (!name && !plate) return <>차량 미정</>
  return (
    <>
      {name ? <span className="text-[13px] text-foreground">{name}</span> : null}
      {name && plate ? " · " : null}
      {plate}
    </>
  )
}

/**
 * 모바일 배차 목록: 날짜별 묶음 + 한 건당 두 줄 행(거래처 · 구간/차량·기사 · 운임/수수료).
 * 행에는 버튼이 없고, 행을 누르면 열리는 작업 시트에서 차주 문자·거래처에 보내기·상세·수정·복사 등록·삭제를 한다.
 * 운임·수수료는 기사에게 지급하는 비용과 중개 수수료 기록이라 매출과 합치지 않는다.
 */
export function DispatchMobileList({
  dispatches,
  clientNameMap,
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
  const [message, setMessage] = useState<{ target: MessageTarget; id: string } | null>(null)
  const messageDispatch = message ? (dispatches.find((d) => d.id === message.id) ?? null) : null

  const spansMonths = spansMultipleMonths(groups)
  const sheetDispatch =
    dispatches.find((dispatch) => dispatch.id === sheetId) ?? null

  function openSheet(dispatch: DispatchRow) {
    setSheetId(dispatch.id)
    setIsSheetOpen(true)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 건수는 위 거래처 줄에 있다. 거래처로 걸렀을 때만 그 거래처의 운임·수수료를 보여 준다 */}
      {filteredTotals ? (
        <p className="flex min-h-9 items-center gap-1 text-sm text-muted-foreground tabular-nums">
          합계 <span className="text-foreground">{formatKRW(filteredTotals.freightAmount)}</span>
          {/* 수수료가 없는 거래처는 합계만 */}
          {filteredTotals.feeAmount > 0 ? (
            <>
              {" "}· 수수료 <span className="text-foreground">{formatKRW(filteredTotals.feeAmount)}</span>
            </>
          ) : null}
        </p>
      ) : null}

      {groups.map((group) => (
        <section key={group.date} className="-mx-4 -mt-3 border-b">
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

              <div className="pointer-events-none w-16 shrink-0 pt-0.5 break-keep wrap-anywhere text-xs leading-snug text-muted-foreground">
                {clientNameOf(dispatch, clientNameMap)}
              </div>

              <div className="pointer-events-none min-w-0 flex-1">
                <p className="text-sm leading-snug font-medium break-keep wrap-anywhere">
                  {dispatch.origin} → {dispatch.destination}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  <VehicleLine dispatch={dispatch} />
                </p>
              </div>

              <div className="pointer-events-none flex shrink-0 flex-col items-end gap-0.5">
                {dispatch.freight_amount != null ? (
                  <span className="text-sm font-semibold tabular-nums">
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
              onMessage={(target) => {
                setIsSheetOpen(false)
                setMessage({ target, id: sheetDispatch.id })
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <DispatchMessageSheet
        target={messageDispatch ? message!.target : null}
        dispatch={messageDispatch}
        clientName={messageDispatch ? clientNameOf(messageDispatch, clientNameMap) : ""}
        onOpenChange={(open) => {
          if (!open) setMessage(null)
        }}
      />
    </div>
  )
}


export function DispatchActionSheetBody({
  dispatch,
  clientName,
  onDelete,
  onMessage,
}: {
  dispatch: DispatchRow
  clientName: string
  onDelete: () => void
  /** 있으면 맨 위에 [차주 문자][거래처에 보내기] 버튼 */
  onMessage?: (target: MessageTarget) => void
}) {
  const contactName = dispatch.contact_name?.trim() ?? ""
  const contactPhone = dispatch.contact_phone?.trim() ?? ""
  const driverName = dispatch.driver_name_snapshot?.trim() ?? ""
  const driverPhone = dispatch.driver_phone_snapshot?.trim() ?? ""
  const plate = dispatch.plate_no_snapshot?.trim() ?? ""

  // 차종(차량 쪽: 차종·파렛)과 물량(화물: 물량·톤)을 따로 보여 준다
  const carSpec = [
    dispatch.cargo_box_type ? CARGO_BOX_TYPE_LABELS[dispatch.cargo_box_type] : "",
    dispatch.pallet_count != null ? `파렛 ${dispatch.pallet_count}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
  const cargo = [dispatch.cargo_note?.trim() ?? "", dispatch.weight_ton != null ? `${dispatch.weight_ton}톤` : ""]
    .filter(Boolean)
    .join(" · ")

  const details: { label: string; value: ReactNode }[] = [
    { label: "하차일", value: DROPOFF_TYPE_LABELS[dispatch.dropoff_type] },
    { label: "차종", value: carSpec },
    { label: "물량", value: cargo },
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
        <SheetTitle className="leading-snug break-keep wrap-anywhere">
          {dispatch.origin} → {dispatch.destination}
        </SheetTitle>
        <SheetDescription>
          {formatDateWithWeekday(dispatch.dispatch_date)} · {clientName}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-3 px-4">
        <div className="flex flex-col">
          {/* 연락처 줄: 전화 버튼은 줄 끝에 세로로 가지런히, 제목·글자는 가운데 높이로 */}
          {contactName || contactPhone ? (
            <ContactRow label="담당자" name={contactName || "-"} phone={contactPhone} />
          ) : null}
          {plate || driverName || driverPhone ? (
            <ContactRow label="차량" name={driverName || "-"} extra={plate || undefined} phone={driverPhone} sms />
          ) : null}
          {details.map((detail) => (
            <div key={detail.label} className="flex min-h-11 items-center gap-3 border-b py-1.5 text-sm last:border-b-0">
              <span className="w-14 shrink-0 text-muted-foreground">{detail.label}</span>
              <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">{detail.value}</span>
            </div>
          ))}
        </div>

        {onMessage ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onMessage("driver")}
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-[#34507d] text-[15px] font-semibold text-[#e3ecfb] active:opacity-80"
            >
              <Truck className="size-4" /> 차주 문자
            </button>
            <button
              type="button"
              onClick={() => onMessage("client")}
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-[#355a43] text-[15px] font-semibold text-[#e0f4e7] active:opacity-80"
            >
              <Building2 className="size-4" /> 거래처 문자
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" className="h-11" asChild>
            <Link href={`/dispatches/${dispatch.id}`} prefetch>상세</Link>
          </Button>
          <Button variant="outline" className="h-11" asChild>
            <ReturnToLink href={`/dispatches/${dispatch.id}/edit`} prefetch>수정</ReturnToLink>
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
