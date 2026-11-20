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
import type { DispatchRow } from "@/lib/supabase/database.types"

import { deleteDispatchAction } from "./actions"
import { DispatchMobileList } from "./dispatch-mobile-list"

interface DispatchListProps {
  dispatches: DispatchRow[]
  clientNameMap: Record<string, string>
  totalCount: number
  summary: {
    freightAmount: number
    feeAmount: number
  }
  page: number
  totalPages: number
}

/**
 * 배차(차량 섭외) 목록. 실제 수익은 매출 페이지 담당이며, 여기 운임/수수료는
 * 기사에게 지급하는 비용·중개 수수료 기록일 뿐 매출과 자동 연결되지 않는다.
 */
export function DispatchList({
  dispatches,
  clientNameMap,
  summary,
  page,
  totalPages,
}: DispatchListProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [deleteTarget, setDeleteTarget] = useState<DispatchRow | null>(null)
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
        await deleteDispatchAction(target.id)
        toast.success("삭제했습니다")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "삭제 실패")
      } finally {
        setDeleteTarget(null)
      }
    })
  }

  if (dispatches.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        조건에 맞는 배차 건이 없습니다.
      </p>
    )
  }

  return (
    <>
      {/* 컴퓨터 화면도 모바일과 같은 목록(2026-11-20): 날짜별 묶음 + 한 건당 두 줄 행 (요약은 페이지 상단 DispatchMobileControls) */}
      <div>
        <DispatchMobileList
          dispatches={dispatches}
          clientNameMap={clientNameMap}
          filteredTotals={
            searchParams.get("client_id") ? summary : null
          }
          onDelete={setDeleteTarget}
        />
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
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
    </>
  )
}
