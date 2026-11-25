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
import { PayDateSheet } from "@/components/sales/pay-date-sheet"
import { salePayText, shortMonthDay } from "@/lib/sales-pay-text"
import {
} from "@/lib/date"
import { formatKRW } from "@/lib/money"
import type { SaleRow } from "@/lib/supabase/database.types"

import { SalesMobileList } from "./sales-mobile-list"
import {
  bulkDeleteSalesAction,
  bulkMarkSalesPaidAction,
  cancelSalePaidAction,
  deleteSaleAction,
  markSalePaidAction,
} from "./actions"

interface SalesListProps {
  sales: SaleRow[]
  summary: {
    count: number
    totalAmount: number
    supplyAmount: number
  }
  page: number
  totalPages: number
  /** false면 "선택"(여러 건 입금·삭제) 줄을 숨긴다 — 달력 아래 그날 내역처럼 짧은 목록 */
  selectable?: boolean
}


/** 매출(실제 수익) 목록 — 차량/기사/화물 정보는 배차 페이지 담당, 여기서는 다루지 않는다 */
export function SalesList({
  sales,
  page,
  totalPages,
  selectable = true,
}: SalesListProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // 모바일 목록에서만 쓰는 "선택" 모드: 켜져 있을 때만 행에 체크박스가 나온다.
  const [selectMode, setSelectMode] = useState(false)
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [singlePayTarget, setSinglePayTarget] = useState<SaleRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SaleRow | null>(null)
  const [cancelPayTarget, setCancelPayTarget] = useState<SaleRow | null>(null)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()


  function pageHref(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(nextPage))
    return `${pathname}?${params.toString()}`
  }

  function changeSelectMode(next: boolean) {
    setSelectMode(next)
    if (!next) setSelected(new Set())
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(sales.map((s) => s.id)) : new Set())
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function handleBulkConfirm(bulkPaidAt: string) {
    const ids = Array.from(selected)
    startTransition(async () => {
      try {
        await bulkMarkSalesPaidAction(ids, bulkPaidAt)
        toast.success(`${ids.length}건 입금 처리했어요 · ${shortMonthDay(bulkPaidAt)}`)
        setSelected(new Set())
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "입금 처리 실패")
      } finally {
        setBulkDialogOpen(false)
      }
    })
  }

  function handleSinglePayConfirm(singlePaidAt: string) {
    if (!singlePayTarget) return
    const target = singlePayTarget
    startTransition(async () => {
      try {
        await markSalePaidAction(target.id, singlePaidAt)
        toast.success(`입금 처리했어요 · ${shortMonthDay(singlePaidAt)}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "입금 처리 실패")
      } finally {
        setSinglePayTarget(null)
      }
    })
  }

  function handleCancelPayConfirm() {
    if (!cancelPayTarget) return
    const target = cancelPayTarget
    startTransition(async () => {
      try {
        await cancelSalePaidAction(target.id)
        toast.success("입금을 취소했습니다")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "입금 취소 실패")
      } finally {
        setCancelPayTarget(null)
      }
    })
  }

  function handleBulkDeleteConfirm() {
    const ids = Array.from(selected)
    startTransition(async () => {
      try {
        await bulkDeleteSalesAction(ids)
        toast.success(`${ids.length}건 삭제했습니다`)
        setSelected(new Set())
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "삭제 실패")
      } finally {
        setBulkDeleteDialogOpen(false)
      }
    })
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    const target = deleteTarget
    startTransition(async () => {
      try {
        await deleteSaleAction(target.id)
        toast.success("삭제했습니다")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "삭제 실패")
      } finally {
        setDeleteTarget(null)
      }
    })
  }

  if (sales.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        조건에 맞는 매출 건이 없습니다.
      </p>
    )
  }

  return (
    <>
      {selected.size > 0 ? (
        <div className="sticky top-0 z-20 mb-3 flex items-center gap-2 rounded-md border bg-muted p-2">
          <span className="text-sm">{selected.size}건 선택됨</span>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setBulkDialogOpen(true)
            }}
          >
            일괄 입금 처리
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteDialogOpen(true)}
          >
            일괄삭제
          </Button>
        </div>
      ) : null}

      {/* 컴퓨터 화면도 모바일과 같은 목록(2026-11-20): 날짜별 묶음 + 한 건당 두 줄 행 (요약은 페이지 상단 SalesMobileControls) */}
      <div>
        <SalesMobileList
          sales={sales}
          selectable={selectable}
          selectMode={selectMode}
          onSelectModeChange={changeSelectMode}
          selected={selected}
          onToggleSelected={toggleOne}
          onToggleAll={toggleAll}
          onPay={(sale) => {
            setSinglePayTarget(sale)
          }}
          onCancelPaid={setCancelPayTarget}
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

      {/* 여러 건 한꺼번에 입금 처리 */}
      <PayDateSheet
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        disabled={isPending}
        title={`${selected.size}건 입금 처리할까요?`}
        caption={`합계 ${formatKRW(sales.filter((s) => selected.has(s.id)).reduce((sum, s) => sum + s.total_amount, 0))}`}
        onPick={handleBulkConfirm}
      />

      {/* 한 건 입금 처리 */}
      <PayDateSheet
        open={singlePayTarget !== null}
        onOpenChange={(open) => !open && setSinglePayTarget(null)}
        disabled={isPending}
        {...(singlePayTarget ? salePayText(singlePayTarget) : { title: "입금 처리할까요?" })}
        onPick={handleSinglePayConfirm}
      />

      <AlertDialog
        open={cancelPayTarget !== null}
        onOpenChange={(open) => !open && setCancelPayTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>입금 처리를 취소할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelPayTarget
                ? `${cancelPayTarget.origin} → ${cancelPayTarget.destination} 건이 미입금으로 돌아가고 입금일 기록이 지워집니다.`
                : null}
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

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
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

      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selected.size}건을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              휴지통으로 이동하며, 30일 내 복구할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              disabled={isPending}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
