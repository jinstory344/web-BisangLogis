"use client"

import Link from "next/link"
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getTodayInSeoul } from "@/lib/date"
import type { PaymentStatus } from "@/lib/supabase/database.types"

import { deleteDispatchAction, markDispatchPaidAction } from "../actions"

export function DetailActions({
  id,
  paymentStatus,
}: {
  id: string
  paymentStatus: PaymentStatus
}) {
  const router = useRouter()
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [paidAt, setPaidAt] = useState(getTodayInSeoul())
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handlePayConfirm() {
    startTransition(async () => {
      try {
        await markDispatchPaidAction(id, paidAt)
        toast.success("입금 처리했습니다")
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
        await deleteDispatchAction(id)
        toast.success("삭제했습니다")
        router.push("/dispatches")
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
            setPaidAt(getTodayInSeoul())
            setPayDialogOpen(true)
          }}
        >
          입금 처리
        </Button>
      ) : null}
      <Button variant="outline" size="sm" asChild>
        <Link href={`/dispatches/${id}/edit`}>수정</Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDeleteOpen(true)}
      >
        삭제
      </Button>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>입금 처리</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="detail-paid-at">입금일</Label>
            <Input
              id="detail-paid-at"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={handlePayConfirm} disabled={isPending}>
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>배차 건을 삭제할까요?</AlertDialogTitle>
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
