"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

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
import { ReturnToLink } from "@/components/common/return-to-link"
import { Button } from "@/components/ui/button"
import { PayDateSheet } from "@/components/sales/pay-date-sheet"
import { shortMonthDay } from "@/lib/sales-pay-text"
import type { PaymentStatus } from "@/lib/supabase/database.types"

import {
  cancelSalePaidAction,
  deleteSaleAction,
  markSalePaidAction,
} from "../actions"

export function SaleDetailActions({
  id,
  paymentStatus,
  payText,
}: {
  id: string
  paymentStatus: PaymentStatus
  /** 입금 창 제목·설명 (salePayText) */
  payText?: { title: string; caption?: string }
}) {
  const router = useRouter()
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [cancelPayOpen, setCancelPayOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleCancelPayConfirm() {
    startTransition(async () => {
      try {
        await cancelSalePaidAction(id)
        toast.success("입금을 취소했습니다")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "입금 취소 실패")
      } finally {
        setCancelPayOpen(false)
      }
    })
  }

  function handlePayConfirm(paidAt: string) {
    startTransition(async () => {
      try {
        await markSalePaidAction(id, paidAt)
        toast.success(`입금 처리했어요 · ${shortMonthDay(paidAt)}`)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "입금 처리 실패")
      } finally {
        setPayDialogOpen(false)
      }
    })
  }

  function handleDeleteConfirm() {
    startTransition(async () => {
      try {
        await deleteSaleAction(id)
        toast.success("삭제했습니다")
        router.push("/sales")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "삭제 실패")
        setDeleteOpen(false)
      }
    })
  }

  return (
    <div className="flex gap-2">
      {paymentStatus === "UNPAID" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setPayDialogOpen(true)
          }}
        >
          입금 처리
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setCancelPayOpen(true)}
        >
          입금 취소
        </Button>
      )}
      <Button variant="outline" size="sm" asChild>
        <ReturnToLink href={`/sales/${id}/edit`}>수정</ReturnToLink>
      </Button>
      <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
        삭제
      </Button>

      <PayDateSheet
        open={payDialogOpen}
        onOpenChange={setPayDialogOpen}
        disabled={isPending}
        title={payText?.title ?? "입금 처리할까요?"}
        caption={payText?.caption}
        onPick={handlePayConfirm}
      />

      <AlertDialog open={cancelPayOpen} onOpenChange={setCancelPayOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>입금 처리를 취소할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              미입금으로 돌아가고 입금일 기록이 지워집니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>아니요</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelPayConfirm}
              disabled={isPending}
            >
              입금 취소
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>매출 건을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              휴지통으로 이동하며, 30일 내 복구할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isPending}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
