"use client"

import { DetailSheet } from "@/components/layout/detail-sheet"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import type { DayLedgerEntry } from "@/app/(app)/ledger-data"
import { deleteExpenseAction } from "@/app/(app)/expenses/actions"
import { ExpenseActionSheetBody } from "@/app/(app)/expenses/expense-mobile-list"
import {
  cancelSalePaidAction,
  deleteSaleAction,
  markSalePaidAction,
} from "@/app/(app)/sales/actions"
import { SaleActionSheetBody } from "@/app/(app)/sales/sales-mobile-list"
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
import { PayDateSheet } from "@/components/sales/pay-date-sheet"
import { salePayText, shortMonthDay } from "@/lib/sales-pay-text"

/**
 * 비상 화면에서 건을 누르면 뜨는 작업 시트 (매출·지출 목록과 같은 시트).
 * 매출: 입금 처리 · 상세 · 수정 · 복사 등록 · 삭제 (+ 입금 취소)
 * 지출: 수정 · 복사 등록 · 삭제
 * 입금 처리·취소·삭제는 확인 창을 거친 뒤 서버에 저장하고, 서버가 비상 화면을 새로 그린다.
 */
export function LedgerEntryActions({
  entry,
  open,
  onOpenChange,
}: {
  entry: DayLedgerEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [payTarget, setPayTarget] = useState<DayLedgerEntry | null>(null)
  const [cancelPayTarget, setCancelPayTarget] = useState<DayLedgerEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DayLedgerEntry | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function run(task: () => Promise<void>, success: string, failure: string, done: () => void) {
    startTransition(async () => {
      try {
        await task()
        toast.success(success)
        // 비상·검색 등 지금 보고 있는 화면의 합계·목록을 새로 받는다
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : failure)
      } finally {
        done()
      }
    })
  }

  function confirmPay(paidAt: string) {
    if (!payTarget) return
    const id = payTarget.id
    run(() => markSalePaidAction(id, paidAt), `입금 처리했어요 · ${shortMonthDay(paidAt)}`, "입금 처리 실패", () =>
      setPayTarget(null)
    )
  }

  function confirmCancelPay() {
    if (!cancelPayTarget) return
    const id = cancelPayTarget.id
    run(() => cancelSalePaidAction(id), "입금을 취소했습니다", "입금 취소 실패", () =>
      setCancelPayTarget(null)
    )
  }

  function confirmDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    run(
      () => (target.kind === "sale" ? deleteSaleAction(target.id) : deleteExpenseAction(target.id)),
      "삭제했습니다",
      "삭제 실패",
      () => setDeleteTarget(null)
    )
  }

  return (
    <>
      <DetailSheet open={open && entry !== null} onOpenChange={onOpenChange} className="gap-0 pb-6">
          {entry?.kind === "sale" ? (
            <SaleActionSheetBody
              sale={entry.row}
              onPay={() => {
                onOpenChange(false)
                setPayTarget(entry)
              }}
              onCancelPaid={() => {
                onOpenChange(false)
                setCancelPayTarget(entry)
              }}
              onDelete={() => {
                onOpenChange(false)
                setDeleteTarget(entry)
              }}
            />
          ) : entry?.kind === "expense" ? (
            <ExpenseActionSheetBody
              expense={entry.row}
              onDelete={() => {
                onOpenChange(false)
                setDeleteTarget(entry)
              }}
            />
          ) : null}
        
</DetailSheet>

      <PayDateSheet
        open={payTarget !== null}
        onOpenChange={(next) => !next && setPayTarget(null)}
        disabled={isPending}
        {...(payTarget?.kind === "sale" ? salePayText(payTarget.row) : { title: "입금 처리할까요?" })}
        onPick={confirmPay}
      />

      <AlertDialog
        open={cancelPayTarget !== null}
        onOpenChange={(next) => !next && setCancelPayTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>입금 처리를 취소할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelPayTarget?.kind === "sale"
                ? `${cancelPayTarget.route} 건이 미입금으로 돌아가고 입금일 기록이 지워집니다.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>아니요</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancelPay} disabled={isPending}>
              입금 취소
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.kind === "expense" ? "지출 내역을" : "매출 건을"} 삭제할까요?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === "expense" && deleteTarget.row.installment_group_id
                ? `할부 ${deleteTarget.row.installment_months}회차가 모두 함께 지워져요. `
                : ""}
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
