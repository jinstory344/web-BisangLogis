"use client"

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
import { formatSearchDate } from "@/lib/search"
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
  side: string
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
          <p className="mt-0.5 truncate">{side}</p>
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

const LIST_CLASS = "-mx-4 -mt-3 divide-y md:mx-0"

/** 최근 날짜부터, 같은 날이면 최근 등록부터 */
function byRecent(a: DayLedgerEntry, b: DayLedgerEntry): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
}

/** 찾은 매출(파랑)·지출(빨강). 누르면 입금 처리·상세·수정·복사·삭제 시트가 뜬다. */
export function SearchLedgerList({
  entries,
  emptyMessage,
}: {
  entries: DayLedgerEntry[]
  emptyMessage: string
}) {
  const [sheetEntry, setSheetEntry] = useState<DayLedgerEntry | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  if (entries.length === 0) return <EmptyMessage>{emptyMessage}</EmptyMessage>

  function open(entry: DayLedgerEntry) {
    setSheetEntry(entry)
    setIsSheetOpen(true)
  }

  return (
    <>
      <ul className={LIST_CLASS}>
        {[...entries].sort(byRecent).map((entry) =>
          entry.kind === "sale" ? (
            <ResultRow
              key={`sale-${entry.id}`}
              onOpen={() => open(entry)}
              date={entry.date}
              side={entry.source}
              title={entry.route}
              sub={`매출 · ${entry.sourceMajor}`}
              amount={formatKRW(entry.amount)}
              amountClassName={INCOME_TEXT_CLASS}
              note={
                entry.isUnpaid ? (
                  <span className="text-xs font-medium text-destructive">미입금</span>
                ) : null
              }
            />
          ) : (
            <ResultRow
              key={`expense-${entry.id}`}
              onOpen={() => open(entry)}
              date={entry.date}
              side={entry.major}
              title={entry.minor}
              sub={entry.note}
              amount={formatKRW(entry.amount)}
              amountClassName={EXPENSE_TEXT_CLASS}
              note={
                entry.paymentLabel ? (
                  <span className="text-xs text-muted-foreground">
                    {entry.paymentLabel}
                  </span>
                ) : null
              }
            />
          )
        )}
      </ul>

      <LedgerEntryActions
        entry={sheetEntry}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
      />
    </>
  )
}

/** "12가3456 · 김기사" (차량을 아직 정하지 않았으면 "차량 미정") */
function vehicleLine(dispatch: SearchDispatch): string {
  const text = [dispatch.plate_no_snapshot, dispatch.driver_name_snapshot]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ")
  return text || "차량 미정"
}

/** 찾은 배차 (조회가 이미 최근 날짜순). 누르면 배차 목록과 같은 작업 시트가 뜬다. */
export function SearchDispatchList({
  dispatches,
  clientNameMap,
  emptyMessage,
}: {
  dispatches: SearchDispatch[]
  clientNameMap: Record<string, string>
  emptyMessage: string
}) {
  const router = useRouter()
  const [sheetDispatch, setSheetDispatch] = useState<SearchDispatch | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SearchDispatch | null>(null)
  const [isPending, startTransition] = useTransition()

  if (dispatches.length === 0) return <EmptyMessage>{emptyMessage}</EmptyMessage>

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

  return (
    <>
      <ul className={LIST_CLASS}>
        {dispatches.map((dispatch) => (
          <ResultRow
            key={dispatch.id}
            onOpen={() => {
              setSheetDispatch(dispatch)
              setIsSheetOpen(true)
            }}
            date={dispatch.dispatch_date}
            side={clientNameOf(dispatch)}
            title={`${dispatch.origin} → ${dispatch.destination}`}
            sub={vehicleLine(dispatch)}
            amount={
              dispatch.freight_amount != null ? formatKRW(dispatch.freight_amount) : "-"
            }
            note={
              dispatch.fee_amount > 0 ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  수수료 {formatKRW(dispatch.fee_amount)}
                </span>
              ) : null
            }
          />
        ))}
      </ul>

      <Sheet open={isSheetOpen && sheetDispatch !== null} onOpenChange={setIsSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85svh] gap-0 overflow-y-auto pb-6">
          {sheetDispatch ? (
            <DispatchActionSheetBody
              dispatch={sheetDispatch}
              clientName={clientNameOf(sheetDispatch)}
              onDelete={() => {
                setIsSheetOpen(false)
                setDeleteTarget(sheetDispatch)
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>배차 건을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              휴지통으로 이동하며, 30일 내 복구할 수 있습니다.
            </AlertDialogDescription>
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
