"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import {
  bulkDeleteDispatchesAction,
  bulkMarkDispatchesPaidAction,
  deleteDispatchAction,
  markDispatchPaidAction,
} from "@/app/(app)/dispatches/actions"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PaymentBadge } from "@/components/dispatches/payment-badge"
import { PAYMENT_METHOD_LABELS } from "@/lib/constants/payment-method"
import { formatShortDate, getTodayInSeoul } from "@/lib/date"
import { formatKRW } from "@/lib/money"
import type { DispatchRow } from "@/lib/supabase/database.types"

interface SalesListProps {
  dispatches: DispatchRow[]
  clientNameMap: Record<string, string>
  summary: {
    count: number
    totalAmount: number
    supplyAmount: number
  }
  page: number
  totalPages: number
}

/** 매출(재무 정보) 목록 — 수수료는 배차 페이지 담당, 여기서는 다루지 않는다 */
export function SalesList({
  dispatches,
  clientNameMap,
  summary,
  page,
  totalPages,
}: SalesListProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkPaidAt, setBulkPaidAt] = useState(getTodayInSeoul())
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [singlePayTarget, setSinglePayTarget] = useState<DispatchRow | null>(
    null
  )
  const [singlePaidAt, setSinglePaidAt] = useState(getTodayInSeoul())
  const [deleteTarget, setDeleteTarget] = useState<DispatchRow | null>(null)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function pageHref(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(nextPage))
    return `${pathname}?${params.toString()}`
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(dispatches.map((d) => d.id)) : new Set())
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function handleBulkConfirm() {
    const ids = Array.from(selected)
    startTransition(async () => {
      try {
        await bulkMarkDispatchesPaidAction(ids, bulkPaidAt)
        toast.success(`${ids.length}건 입금 처리했습니다`)
        setSelected(new Set())
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "입금 처리 실패")
      } finally {
        setBulkDialogOpen(false)
      }
    })
  }

  function handleSinglePayConfirm() {
    if (!singlePayTarget) return
    const target = singlePayTarget
    startTransition(async () => {
      try {
        await markDispatchPaidAction(target.id, singlePaidAt)
        toast.success("입금 처리했습니다")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "입금 처리 실패")
      } finally {
        setSinglePayTarget(null)
      }
    })
  }

  function handleBulkDeleteConfirm() {
    const ids = Array.from(selected)
    startTransition(async () => {
      try {
        await bulkDeleteDispatchesAction(ids)
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
        조건에 맞는 매출 건이 없습니다.
      </p>
    )
  }

  return (
    <>
      {selected.size > 0 ? (
        <div className="mb-3 flex items-center gap-2 rounded-md border bg-muted/50 p-2">
          <span className="text-sm">{selected.size}건 선택됨</span>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setBulkPaidAt(getTodayInSeoul())
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

      {/* 데스크톱 표 */}
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    selected.size > 0 && selected.size === dispatches.length
                  }
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                />
              </TableHead>
              <TableHead>날짜</TableHead>
              <TableHead>거래처</TableHead>
              <TableHead>구간</TableHead>
              <TableHead className="text-right">공급가액</TableHead>
              <TableHead className="text-right">세액</TableHead>
              <TableHead className="text-right">합계금액</TableHead>
              <TableHead>지불방법</TableHead>
              <TableHead>입금여부</TableHead>
              <TableHead>입금일</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dispatches.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(d.id)}
                    onCheckedChange={(checked) =>
                      toggleOne(d.id, checked === true)
                    }
                  />
                </TableCell>
                <TableCell>{d.dispatch_date}</TableCell>
                <TableCell>
                  {d.client_id ? clientNameMap[d.client_id] ?? "-" : "-"}
                </TableCell>
                <TableCell>
                  {d.origin} → {d.destination}
                </TableCell>
                <TableCell className="text-right">
                  {formatKRW(d.supply_amount)}
                </TableCell>
                <TableCell className="text-right">
                  {formatKRW(d.vat_amount)}
                </TableCell>
                <TableCell className="text-right">
                  {formatKRW(d.total_amount)}
                </TableCell>
                <TableCell>{PAYMENT_METHOD_LABELS[d.payment_method]}</TableCell>
                <TableCell>
                  <PaymentBadge status={d.payment_status} />
                </TableCell>
                <TableCell>
                  {d.paid_at ? formatShortDate(d.paid_at) : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {d.payment_status === "UNPAID" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSinglePaidAt(getTodayInSeoul())
                          setSinglePayTarget(d)
                        }}
                      >
                        입금 처리
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dispatches/${d.id}`}>상세</Link>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(d)}
                    >
                      삭제
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t bg-muted/30 p-3 text-sm font-medium">
          <span>{summary.count}건</span>
          <span>합계금액 {formatKRW(summary.totalAmount)}</span>
          <span>공급가액 {formatKRW(summary.supplyAmount)}</span>
        </div>
      </div>

      {/* 모바일 카드 리스트 */}
      <div className="flex flex-col gap-2 md:hidden">
        {dispatches.map((d) => (
          <div key={d.id} className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  className="mt-1"
                  checked={selected.has(d.id)}
                  onCheckedChange={(checked) =>
                    toggleOne(d.id, checked === true)
                  }
                />
                <div>
                  <p className="inline-block rounded bg-muted px-1.5 py-0.5 text-sm text-muted-foreground italic">
                    {d.dispatch_date}
                  </p>
                  <p className="font-medium">
                    {d.origin} → {d.destination}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {d.client_id ? clientNameMap[d.client_id] ?? "-" : "-"}
                    {d.contact_name ? ` (${d.contact_name})` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <PaymentBadge status={d.payment_status} />
                {d.paid_at ? (
                  <span className="text-xs text-muted-foreground">
                    {formatShortDate(d.paid_at)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-right font-medium">
                {formatKRW(d.supply_amount)}
              </span>
              <div className="flex gap-2">
                {d.payment_status === "UNPAID" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSinglePaidAt(getTodayInSeoul())
                      setSinglePayTarget(d)
                    }}
                  >
                    입금 처리
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dispatches/${d.id}`}>상세</Link>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteTarget(d)}
                >
                  삭제
                </Button>
              </div>
            </div>
          </div>
        ))}
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between">
            <span>{summary.count}건</span>
            <span className="text-base">
              합계금액 {formatKRW(summary.supplyAmount)}
            </span>
          </div>
        </div>
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

      {/* 일괄 입금 처리 다이얼로그 */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected.size}건 일괄 입금 처리</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bulk-paid-at">입금일</Label>
            <Input
              id="bulk-paid-at"
              type="date"
              value={bulkPaidAt}
              onChange={(e) => setBulkPaidAt(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleBulkConfirm} disabled={isPending}>
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 개별 입금 처리 다이얼로그 */}
      <Dialog
        open={singlePayTarget !== null}
        onOpenChange={(open) => !open && setSinglePayTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>입금 처리</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="single-paid-at">입금일</Label>
            <Input
              id="single-paid-at"
              type="date"
              value={singlePaidAt}
              onChange={(e) => setSinglePaidAt(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleSinglePayConfirm} disabled={isPending}>
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
