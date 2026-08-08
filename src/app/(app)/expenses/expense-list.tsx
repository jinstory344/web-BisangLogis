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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EXPENSE_PAYMENT_METHOD_LABELS } from "@/lib/constants/payment-method"
import { formatKRW } from "@/lib/money"
import type { ExpenseRow } from "@/lib/supabase/database.types"

import { deleteExpenseAction } from "./actions"

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
  summary,
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
      {/* 데스크톱 표 */}
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>날짜</TableHead>
              <TableHead>대분류</TableHead>
              <TableHead>소분류</TableHead>
              <TableHead className="text-right">금액</TableHead>
              <TableHead>결제수단</TableHead>
              <TableHead>비고</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>{expense.expense_date}</TableCell>
                <TableCell>{expense.category_major}</TableCell>
                <TableCell>{expense.category_minor}</TableCell>
                <TableCell className="text-right">
                  {formatKRW(expense.amount)}
                </TableCell>
                <TableCell>
                  {expense.payment_method
                    ? EXPENSE_PAYMENT_METHOD_LABELS[expense.payment_method]
                    : "-"}
                </TableCell>
                <TableCell className="max-w-40 truncate">
                  {expense.memo ?? "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/expenses/${expense.id}/edit`}>수정</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteTarget(expense)}
                    >
                      삭제
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="border-t bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between font-medium">
            <span>{summary.count}건</span>
            <span>합계 {formatKRW(summary.total)}</span>
          </div>
          {summary.byMajor.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
              {summary.byMajor.map((row) => (
                <span key={row.major}>
                  {row.major} {formatKRW(row.total)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* 모바일 카드 리스트 */}
      <div className="flex flex-col gap-2 md:hidden">
        {expenses.map((expense) => (
          <div key={expense.id} className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  {expense.expense_date}
                </p>
                <p className="font-medium">
                  {expense.category_major} · {expense.category_minor}
                </p>
              </div>
              <span className="font-medium">{formatKRW(expense.amount)}</span>
            </div>
            <div className="mt-2 flex items-center justify-end">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/expenses/${expense.id}/edit`}>수정</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteTarget(expense)}
                >
                  삭제
                </Button>
              </div>
            </div>
          </div>
        ))}
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between font-medium">
            <span>{summary.count}건</span>
            <span>합계 {formatKRW(summary.total)}</span>
          </div>
        </div>
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
