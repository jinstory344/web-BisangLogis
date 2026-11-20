"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
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
} from "@/lib/date"
import type { ExpenseRow } from "@/lib/supabase/database.types"

import { deleteExpenseAction } from "./actions"
import { ExpenseMobileList } from "./expense-mobile-list"

interface ExpenseListProps {
  expenses: ExpenseRow[]
  summary: {
    count: number
    total: number
    byMajor: { major: string; total: number }[]
  }
  page: number
  totalPages: number
}


export function ExpenseList({
  expenses,
  page,
  totalPages,
}: ExpenseListProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null)
  const [isPending, startTransition] = useTransition()


  function pageHref(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(nextPage))
    return `${pathname}?${params.toString()}`
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    const target = deleteTarget
    startTransition(async () => {
      try {
        await deleteExpenseAction(target.id)
        toast.success("삭제했습니다")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "삭제 실패")
      } finally {
        setDeleteTarget(null)
      }
    })
  }

  if (expenses.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        조건에 맞는 지출 내역이 없습니다.
      </p>
    )
  }

  return (
    <>
      {/* 컴퓨터 화면도 모바일과 같은 목록(2026-11-20): 날짜별 묶음 + 한 건당 두 줄 행 (요약은 페이지 상단 ExpenseMobileControls) */}
      <div>
        <ExpenseMobileList
          expenses={expenses}
          onDelete={setDeleteTarget}
        />
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            asChild={page > 1}
          >
            {page > 1 ? (
              <Link href={pageHref(page - 1)}>이전</Link>
            ) : (
              <span>이전</span>
            )}
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            asChild={page < totalPages}
          >
            {page < totalPages ? (
              <Link href={pageHref(page + 1)}>다음</Link>
            ) : (
              <span>다음</span>
            )}
          </Button>
        </div>
      ) : null}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>지출 내역을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.installment_group_id
                ? `할부 ${deleteTarget.installment_months}회차가 모두 함께 지워져요. `
                : ""}
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
    </>
  )
}
