"use client"

import { SaleSourceCell } from "@/components/ledger/sale-source-cell"
import { Check, Phone } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { ReturnToLink } from "@/components/common/return-to-link"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PAID_TEXT_CLASS } from "@/components/dispatches/payment-badge"
import { DayHeader } from "@/components/list/day-header"
import { PAYMENT_METHOD_LABELS } from "@/lib/constants/payment-method"
import { formatSaleSource } from "@/lib/constants/sale-sources"
import { spansMultipleMonths } from "@/lib/day-groups"
import { formatDateWithWeekday, formatMonthDay } from "@/lib/date"
import { formatKRW } from "@/lib/money"
import { formatPhoneNumber } from "@/lib/phone"
import { groupSalesByDay } from "@/lib/sales-list"
import type { SaleRow } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

interface SalesMobileListProps {
  sales: SaleRow[]
  selectMode: boolean
  onSelectModeChange: (selectMode: boolean) => void
  selected: ReadonlySet<string>
  onToggleSelected: (id: string, checked: boolean) => void
  onToggleAll: (checked: boolean) => void
  onPay: (sale: SaleRow) => void
  /** 실수로 입금 처리했을 때 되돌린다 (작업 시트의 작은 "입금 취소") */
  onCancelPaid: (sale: SaleRow) => void
  onDelete: (sale: SaleRow) => void
}

function PaidLabel({ sale }: { sale: SaleRow }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        PAID_TEXT_CLASS
      )}
    >
      <Check className="size-3" aria-hidden />
      입금 {sale.paid_at ? formatMonthDay(sale.paid_at) : ""}
    </span>
  )
}

/**
 * 모바일 매출 목록: 날짜별 묶음 + 한 건당 두 줄 행.
 * 행에는 버튼이 없다. 미입금은 작은 글자로만 표시하고, 행을 누르면 열리는 작업 시트에서
 * 입금 처리·상세·수정·복사·삭제를 한다(목록에서 큰 버튼을 잘못 누르는 일을 막기 위해).
 * 여러 건 선택은 "선택" 모드에서만 체크박스가 나온다.
 */
export function SalesMobileList({
  sales,
  selectMode,
  onSelectModeChange,
  selected,
  onToggleSelected,
  onToggleAll,
  onPay,
  onCancelPaid,
  onDelete,
}: SalesMobileListProps) {
  const groups = useMemo(() => groupSalesByDay(sales), [sales])
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  // 기간이 여러 달에 걸치면 날짜 머리글에 월을 함께 보여 준다.
  const spansMonths = spansMultipleMonths(groups)

  const sheetSale = sales.find((sale) => sale.id === sheetId) ?? null
  const allSelected = sales.length > 0 && selected.size === sales.length

  function openSheet(sale: SaleRow) {
    setSheetId(sale.id)
    setIsSheetOpen(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-9 items-center justify-between">
        {selectMode ? (
          <>
            <button
              type="button"
              className="text-sm font-medium underline underline-offset-2"
              onClick={() => onToggleAll(!allSelected)}
            >
              {allSelected ? "전체 해제" : "전체 선택"}
            </button>
            <button
              type="button"
              className="px-2 py-1.5 text-sm font-medium"
              onClick={() => onSelectModeChange(false)}
            >
              취소
            </button>
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">
              {sales.length}건
            </span>
            <button
              type="button"
              className="px-2 py-1.5 text-sm font-medium text-muted-foreground"
              onClick={() => onSelectModeChange(true)}
            >
              선택
            </button>
          </>
        )}
      </div>

      {groups.map((group) => (
        <section key={group.date} className="-mx-4 -mt-3 overflow-hidden border-b">
          <DayHeader
            date={group.date}
            totalLabel={formatKRW(group.supplyAmount)}
            showMonth={spansMonths}
          />

          {group.rows.map((sale) => {
            const isSelected = selected.has(sale.id)
            return (
              <div
                key={sale.id}
                className={cn(
                  "relative flex items-start gap-3 border-t px-4 py-2.5 first:border-t-0",
                  isSelected && "bg-muted/60"
                )}
              >
                {/* 행 전체가 눌리는 영역(누르면 작업 시트). 안쪽 글자는 클릭을 그대로 통과시킨다. */}
                <button
                  type="button"
                  aria-label={`${sale.origin}에서 ${sale.destination}, ${formatKRW(sale.supply_amount)}`}
                  aria-pressed={selectMode ? isSelected : undefined}
                  className="absolute inset-0 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/60"
                  onClick={() =>
                    selectMode
                      ? onToggleSelected(sale.id, !isSelected)
                      : openSheet(sale)
                  }
                />

                {selectMode ? (
                  <Checkbox
                    aria-hidden
                    tabIndex={-1}
                    className="pointer-events-none mt-0.5"
                    checked={isSelected}
                  />
                ) : null}

                <div className="pointer-events-none w-16 shrink-0 truncate pt-0.5 text-xs leading-snug text-muted-foreground">
                  <SaleSourceCell sale={sale} />
                </div>

                <div className="pointer-events-none min-w-0 flex-1">
                  <p className="text-sm leading-snug font-medium break-keep wrap-anywhere">
                    {sale.origin} → {sale.destination}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatSaleSource(sale.source_major, sale.source_sub) || "-"} ·{" "}
                    {PAYMENT_METHOD_LABELS[sale.payment_method]}
                  </p>
                </div>

                <div className="pointer-events-none flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatKRW(sale.supply_amount)}
                  </span>
                  {sale.payment_status === "PAID" ? (
                    <PaidLabel sale={sale} />
                  ) : (
                    <span className="text-xs font-medium text-destructive">
                      미입금
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      ))}

      <Sheet open={isSheetOpen && sheetSale !== null} onOpenChange={setIsSheetOpen}>
        <SheetContent side="bottom" className="gap-0 pb-6">
          {sheetSale ? (
            <SaleActionSheetBody
              sale={sheetSale}
              onPay={() => {
                setIsSheetOpen(false)
                onPay(sheetSale)
              }}
              onCancelPaid={() => {
                setIsSheetOpen(false)
                onCancelPaid(sheetSale)
              }}
              onDelete={() => {
                setIsSheetOpen(false)
                onDelete(sheetSale)
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

export function SaleActionSheetBody({
  sale,
  onPay,
  onCancelPaid,
  onDelete,
}: {
  sale: SaleRow
  onPay: () => void
  onCancelPaid: () => void
  onDelete: () => void
}) {
  const phone = sale.order_contact_phone?.trim() ?? ""

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle className="leading-snug break-keep wrap-anywhere">
          {sale.origin} → {sale.destination}
        </SheetTitle>
        <SheetDescription>
          {formatDateWithWeekday(sale.sale_date)} ·{" "}
          {formatSaleSource(sale.source_major, sale.source_sub) || "-"}
          {sale.source_minor ? ` / ${sale.source_minor}` : ""}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-3 px-4">
        <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-center">
          <div>
            <dt className="text-xs text-muted-foreground">공급가액</dt>
            <dd className="font-semibold tabular-nums">
              {formatKRW(sale.supply_amount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">세액</dt>
            <dd className="font-semibold tabular-nums">
              {formatKRW(sale.vat_amount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">합계금액</dt>
            <dd className="font-semibold tabular-nums">
              {formatKRW(sale.total_amount)}
            </dd>
          </div>
        </dl>

        <p className="text-sm text-muted-foreground">
          {PAYMENT_METHOD_LABELS[sale.payment_method]} ·{" "}
          {sale.payment_status === "PAID" ? (
            <>
              <span className={cn("font-medium", PAID_TEXT_CLASS)}>
                입금완료
                {sale.paid_at ? ` (${formatMonthDay(sale.paid_at)})` : ""}
              </span>{" "}
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-2"
                onClick={onCancelPaid}
              >
                입금 취소
              </button>
            </>
          ) : (
            <span className="font-medium text-destructive">미입금</span>
          )}
          {sale.billing_entity_name
            ? ` · 사업자 정보 ${sale.billing_entity_name}`
            : ""}
        </p>

        {phone ? (
          <a
            href={`tel:${phone.replace(/[^\d+]/g, "")}`}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium underline underline-offset-2"
          >
            <Phone className="size-4" aria-hidden />
            {formatPhoneNumber(phone)}
          </a>
        ) : null}

        {sale.payment_status === "UNPAID" ? (
          <Button type="button" className="h-12 text-base" onClick={onPay}>
            입금 처리
          </Button>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" className="h-11" asChild>
            <Link href={`/sales/${sale.id}`} prefetch>상세</Link>
          </Button>
          <Button variant="outline" className="h-11" asChild>
            <ReturnToLink href={`/sales/${sale.id}/edit`} prefetch>수정</ReturnToLink>
          </Button>
          <Button variant="outline" className="h-11" asChild>
            <Link href={`/sales/new?copy=${sale.id}`}>복사 등록</Link>
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
