"use client"

import { ChevronDown } from "lucide-react"
import { SaleSourceCell } from "@/components/ledger/sale-source-cell"
import { useRouter } from "next/navigation"
import { useState, useTransition, type ReactNode } from "react"
import { toast } from "sonner"

import { EXPENSE_TEXT_CLASS, INCOME_TEXT_CLASS } from "@/components/ledger/colors"
import { LedgerEntryActions } from "@/components/ledger/ledger-entry-actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { formatKRW } from "@/lib/money"
import { formatSearchDate, groupByMonth } from "@/lib/search"
import { cn } from "@/lib/utils"

import { deleteDispatchAction } from "../dispatches/actions"
import { DispatchActionSheetBody } from "../dispatches/dispatch-mobile-list"
import type { DayLedgerEntry } from "../ledger-data"

import type { SearchDispatch } from "./search-data"

/**
 * 검색 결과 목록 (가계부 앱의 검색 화면처럼): 상자 없이 화면 폭을 꽉 채운 얇은 줄들.
 * 한 줄 = 왼쪽(연도까지 날짜 · 분류) / 가운데(내용 · 보조 글) / 오른쪽(금액).
 * 날짜별로 묶지 않고 최근 날짜부터 줄줄이 보여 줘서 한 화면에 많이 보인다.
 * 줄을 누르면 비상·목록 화면과 같은 작업 시트가 뜬다.
 */
function ResultRow({
  onOpen,
  date,
  side,
  title,
  sub,
  amount,
  amountClassName,
  note,
}: {
  onOpen: () => void
  date: string
  side: ReactNode
  title: string
  sub: string
  amount: string
  amountClassName?: string
  note?: ReactNode
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
      >
        <div className="w-[4.75rem] shrink-0 text-xs leading-snug text-muted-foreground">
          <p className="tabular-nums">{formatSearchDate(date)}</p>
          <div className="mt-0.5 truncate">{side}</div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-snug font-medium">{title}</p>
          {sub ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className={cn("text-sm font-semibold tabular-nums", amountClassName)}>
            {amount}
          </span>
          {note}
        </div>
      </button>
    </li>
  )
}

function EmptyMessage({ children }: { children: ReactNode }) {
  return (
    <p className="py-12 text-center text-sm text-muted-foreground">{children}</p>
  )
}

/** "김기사 · 12가3456" (차량을 아직 정하지 않았으면 "차량 미정") */
function vehicleLine(dispatch: SearchDispatch): string {
  const text = [dispatch.driver_name_snapshot, dispatch.plate_no_snapshot]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ")
  return text || "차량 미정"
}

/** 검색 결과 한 줄: 매출·지출(장부 항목) 또는 배차 */
export type SearchItem =
  | { kind: "ledger"; date: string; createdAt: string; entry: DayLedgerEntry }
  | { kind: "dispatch"; date: string; createdAt: string; dispatch: SearchDispatch }

/** 최근 날짜부터, 같은 날이면 최근 등록부터 */
function byRecent(a: SearchItem, b: SearchItem): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
}

/** 달 줄의 합계: 매출(파랑)·지출(빨강)·배차 운임 중 있는 것만 */
function monthTotals(rows: SearchItem[]): ReactNode {
  let sale = 0
  let expense = 0
  let freight = 0
  for (const item of rows) {
    if (item.kind === "dispatch") freight += item.dispatch.freight_amount ?? 0
    else if (item.entry.kind === "sale") sale += item.entry.amount
    else expense += item.entry.amount
  }
  const parts: ReactNode[] = []
  if (sale) parts.push(<span key="s" className={INCOME_TEXT_CLASS}>{formatKRW(sale)}</span>)
  if (expense) parts.push(<span key="e" className={EXPENSE_TEXT_CLASS}>{formatKRW(expense)}</span>)
  if (freight) parts.push(<span key="d">운임 {formatKRW(freight)}</span>)
  return (
    <span className="flex gap-2">
      <span>{rows.length}건</span>
      {parts}
    </span>
  )
}

/**
 * 통합검색 결과: 달별로 묶고(가장 최근 달은 펼침, 달 줄을 누르면 접고 펼침),
 * 매출·지출·배차가 섞여도 줄 왼쪽 아래 글자(매출·지출·배차)와 금액 색으로 구별한다.
 * 줄을 누르면 각 종류의 작업 시트(입금 처리·수정·삭제 등)가 뜬다.
 */
export function SearchResultList({
  items,
  clientNameMap,
  emptyMessage,
}: {
  items: SearchItem[]
  clientNameMap: Record<string, string>
  emptyMessage: string
}) {
  const router = useRouter()
  const [ledgerEntry, setLedgerEntry] = useState<DayLedgerEntry | null>(null)
  const [isLedgerOpen, setIsLedgerOpen] = useState(false)
  const [sheetDispatch, setSheetDispatch] = useState<SearchDispatch | null>(null)
  const [isDispatchOpen, setIsDispatchOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SearchDispatch | null>(null)
  const [isPending, startTransition] = useTransition()
  /** 사용자가 펼치거나 접은 달 (없으면 가장 최근 달만 펼침) */
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({})

  if (items.length === 0) return <EmptyMessage>{emptyMessage}</EmptyMessage>

  function clientNameOf(dispatch: SearchDispatch): string {
    return dispatch.client_id ? (clientNameMap[dispatch.client_id] ?? "-") : "-"
  }

  function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    startTransition(async () => {
      try {
        await deleteDispatchAction(id)
        toast.success("삭제했습니다")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "삭제 실패")
      } finally {
        setDeleteTarget(null)
      }
    })
  }

  function row(item: SearchItem) {
    if (item.kind === "dispatch") {
      const dispatch = item.dispatch
      return (
        <ResultRow
          key={`dispatch-${dispatch.id}`}
          onOpen={() => {
            setSheetDispatch(dispatch)
            setIsDispatchOpen(true)
          }}
          date={dispatch.dispatch_date}
          side={clientNameOf(dispatch)}
          title={`${dispatch.origin} → ${dispatch.destination}`}
          sub={`배차 · ${vehicleLine(dispatch)}`}
          amount={dispatch.freight_amount != null ? formatKRW(dispatch.freight_amount) : "-"}
          note={
            dispatch.fee_amount > 0 ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                수수료 {formatKRW(dispatch.fee_amount)}
              </span>
            ) : null
          }
        />
      )
    }
    const entry = item.entry
    const open = () => {
      setLedgerEntry(entry)
      setIsLedgerOpen(true)
    }
    return entry.kind === "sale" ? (
      <ResultRow
        key={`sale-${entry.id}`}
        onOpen={open}
        date={entry.date}
        side={<SaleSourceCell sale={entry.row} />}
        title={entry.route}
        sub={`매출 · ${entry.sourceMajor}`}
        amount={formatKRW(entry.amount)}
        amountClassName={INCOME_TEXT_CLASS}
        note={entry.isUnpaid ? <span className="text-xs font-medium text-destructive">미입금</span> : null}
      />
    ) : (
      <ResultRow
        key={`expense-${entry.id}`}
        onOpen={open}
        date={entry.date}
        side={entry.major}
        title={entry.minor}
        sub={entry.note ? `지출 · ${entry.note}` : "지출"}
        amount={formatKRW(entry.amount)}
        amountClassName={EXPENSE_TEXT_CLASS}
        note={entry.paymentLabel ? <span className="text-xs text-muted-foreground">{entry.paymentLabel}</span> : null}
      />
    )
  }

  return (
    <>
      <div className="-mx-4 flex flex-col md:mx-0">
        {groupByMonth([...items].sort(byRecent), (item) => item.date).map((group, index) => {
          const isOpen = openMonths[group.month] ?? index === 0
          return (
            <section key={group.month} className="border-b">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenMonths({ ...openMonths, [group.month]: !isOpen })}
                className="flex min-h-12 w-full items-center justify-between gap-2 bg-muted/40 px-4 text-left"
              >
                <span className="flex shrink-0 items-center gap-1 font-semibold">
                  {group.label}
                  <ChevronDown
                    aria-hidden
                    className={cn("size-4 transition-transform", isOpen ? "" : "-rotate-90")}
                  />
                </span>
                <span className="min-w-0 truncate text-[13px] text-muted-foreground tabular-nums">
                  {monthTotals(group.rows)}
                </span>
              </button>
              {isOpen ? <ul className="divide-y border-t">{group.rows.map(row)}</ul> : null}
            </section>
          )
        })}
      </div>

      <LedgerEntryActions entry={ledgerEntry} open={isLedgerOpen} onOpenChange={setIsLedgerOpen} />

      <Sheet open={isDispatchOpen && sheetDispatch !== null} onOpenChange={setIsDispatchOpen}>
        <SheetContent side="bottom" className="max-h-[85svh] gap-0 overflow-y-auto pb-6">
          {sheetDispatch ? (
            <DispatchActionSheetBody
              dispatch={sheetDispatch}
              clientName={clientNameOf(sheetDispatch)}
              onDelete={() => {
                setIsDispatchOpen(false)
                setDeleteTarget(sheetDispatch)
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(next) => !next && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>배차 건을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>휴지통으로 이동하며, 30일 내 복구할 수 있습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
