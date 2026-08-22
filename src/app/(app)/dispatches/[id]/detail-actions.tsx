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

import { deleteDispatchAction } from "../actions"

/** 배차는 금액/입금을 다루지 않으므로 입금 처리는 매출 상세에서만 제공한다. */
export function DetailActions({ id }: { id: string }) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

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
      <Button variant="outline" size="sm" asChild>
        <Link href={`/dispatches/${id}/edit`}>수정</Link>
      </Button>
      <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
        삭제
      </Button>

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
