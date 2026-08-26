"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Fragment, useMemo, useState, useTransition } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
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
import {
  formatDateWithWeekday,
  formatMonthDay,
  formatShortDate,
  getTodayInSeoul,
  getWeekOfMonth,
} from "@/lib/date"
import { formatKRW } from "@/lib/money"
import { formatPhoneNumber } from "@/lib/phone"
import type { SaleRow } from "@/lib/supabase/database.types"

import {
  bulkDeleteSalesAction,
  bulkMarkSalesPaidAction,
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
}

interface WeekGroup {
  key: string
  label: string
  rows: SaleRow[]
  totalAmount: number
  supplyAmount: number
}

/** sale_date 내림차순으로 정렬된 목록을 "M월 N주차" 단위로 묶는다 */
function groupSalesByWeek(sales: SaleRow[]): WeekGroup[] {
  const groups: WeekGroup[] = []
  const indexByKey = new Map<string, number>()

  for (const s of sales) {
    const [year, month] = s.sale_date.split("-")
    const week = getWeekOfMonth(s.sale_date)
    const key = `${year}-${month}-${week}`

    let idx = indexByKey.get(key)
    if (idx === undefined) {
      idx = groups.length
      indexByKey.set(key, idx)
      groups.push({
        key,
        label: `${Number(month)}월 ${week}주차`,
        rows: [],
        totalAmount: 0,
        supplyAmount: 0,
      })
    }

    const group = groups[idx]
    group.rows.push(s)
    group.totalAmount += s.total_amount
    group.supplyAmount += s.supply_amount
  }

  return groups
}

/** 매출(실제 수익) 목록 — 차량/기사/화물 정보는 배차 페이지 담당, 여기서는 다루지 않는다 */
export function SalesList({
  sales,
  summary,
  page,
  totalPages,
}: SalesListProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkPaidAt, setBulkPaidAt] = useState(getTodayInSeoul())
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [singlePayTarget, setSinglePayTarget] = useState<SaleRow | null>(null)
  const [singlePaidAt, setSinglePaidAt] = useState(getTodayInSeoul())
  const [deleteTarget, setDeleteTarget] = useState<SaleRow | null>(null)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const weekGroups = useMemo(() => groupSalesByWeek(sales), [sales])
  // 가장 최근 주차만 펼친 채로 시작하고 나머지는 클릭해서 펼쳐보게 한다.
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(
    () => new Set(weekGroups.slice(0, 1).map((g) => g.key))
  )

  function toggleWeek(key: string) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function pageHref(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(nextPage))
    return `${pathname}?${params.toString()}`
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

  function handleBulkConfirm() {
    const ids = Array.from(selected)
    startTransition(async () => {
      try {
        await bulkMarkSalesPaidAction(ids, bulkPaidAt)
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
        await markSalePaidAction(target.id, singlePaidAt)
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
                  checked={selected.size > 0 && selected.size === sales.length}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                />
              </TableHead>
              <TableHead>날짜</TableHead>
              <TableHead>구간</TableHead>
              <TableHead>출처</TableHead>
              <TableHead>계산서정보</TableHead>
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
            {weekGroups.map((group) => {
              const isExpanded = expandedWeeks.has(group.key)
              return (
                <Fragment key={group.key}>
                  <TableRow
                    className="cursor-pointer bg-muted/40 hover:bg-muted"
                    onClick={() => toggleWeek(group.key)}
                  >
                    <TableCell colSpan={12}>
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 font-medium">
                          {isExpanded ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                          {group.label}
                          <span className="font-normal text-muted-foreground">
                            {formatMonthDay(group.rows[group.rows.length - 1].sale_date)}
                            ~{formatMonthDay(group.rows[0].sale_date)} · {group.rows.length}건
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          합계금액 {formatKRW(group.totalAmount)}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded
                    ? group.rows.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <Checkbox
                              checked={selected.has(s.id)}
                              onCheckedChange={(checked) =>
                                toggleOne(s.id, checked === true)
                              }
                            />
                          </TableCell>
                          <TableCell>{formatDateWithWeekday(s.sale_date)}</TableCell>
                          <TableCell>
                            {s.origin} → {s.destination}
                          </TableCell>
                          <TableCell>
                            {s.source_major ?? "-"}
                            {s.source_minor ? ` / ${s.source_minor}` : ""}
                          </TableCell>
                          <TableCell>{s.billing_entity_name ?? "-"}</TableCell>
                          <TableCell className="text-right">
                            {formatKRW(s.supply_amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatKRW(s.vat_amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatKRW(s.total_amount)}
                          </TableCell>
                          <TableCell>
                            {PAYMENT_METHOD_LABELS[s.payment_method]}
                          </TableCell>
                          <TableCell>
                            <PaymentBadge status={s.payment_status} />
                          </TableCell>
                          <TableCell>
                            {s.paid_at ? formatShortDate(s.paid_at) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {s.payment_status === "UNPAID" ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSinglePaidAt(getTodayInSeoul())
                                    setSinglePayTarget(s)
                                  }}
                                >
                                  입금 처리
                                </Button>
                              ) : null}
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/sales/${s.id}`}>상세</Link>
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteTarget(s)}
                              >
                                삭제
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    : null}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t bg-muted/30 p-3 text-sm font-medium">
          <span>{summary.count}건</span>
          <span>합계금액 {formatKRW(summary.totalAmount)}</span>
          <span>공급가액 {formatKRW(summary.supplyAmount)}</span>
        </div>
      </div>

      {/* 모바일 카드 리스트 */}
      <div className="flex flex-col gap-3 md:hidden">
        {weekGroups.map((group) => {
          const isExpanded = expandedWeeks.has(group.key)
          return (
            <div key={group.key} className="flex flex-col gap-2">
              <button
                type="button"
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 p-3 text-left"
                onClick={() => toggleWeek(group.key)}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  {isExpanded ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                  {group.label}
                  <span className="text-sm font-normal text-muted-foreground">
                    {formatMonthDay(group.rows[group.rows.length - 1].sale_date)}
                    ~{formatMonthDay(group.rows[0].sale_date)} · {group.rows.length}건
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatKRW(group.totalAmount)}
                </span>
              </button>

              {isExpanded
                ? group.rows.map((s) => (
                    <div key={s.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            className="mt-1"
                            checked={selected.has(s.id)}
                            onCheckedChange={(checked) =>
                              toggleOne(s.id, checked === true)
                            }
                          />
                          <div>
                            <p className="inline-block rounded bg-muted px-1.5 py-0.5 text-sm text-muted-foreground italic">
                              {formatDateWithWeekday(s.sale_date)}
                            </p>
                            <p className="font-medium">
                              {s.origin} → {s.destination}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {s.source_major ?? "-"}
                              {s.source_minor ? ` / ${s.source_minor}` : ""}
                              {s.order_contact_phone
                                ? ` ${formatPhoneNumber(s.order_contact_phone)}`
                                : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <PaymentBadge status={s.payment_status} />
                          {s.paid_at ? (
                            <span className="text-xs text-muted-foreground">
                              {formatShortDate(s.paid_at)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-right font-medium">
                          {formatKRW(s.supply_amount)}
                        </span>
                        <div className="flex gap-2">
                          {s.payment_status === "UNPAID" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSinglePaidAt(getTodayInSeoul())
                                setSinglePayTarget(s)
                              }}
                            >
                              입금 처리
                            </Button>
                          ) : null}
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/sales/${s.id}`}>상세</Link>
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteTarget(s)}
                          >
                            삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                : null}
            </div>
          )
        })}
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between">
            <span>{summary.count}건</span>
            <span className="text-base">
              합계금액 {formatKRW(summary.totalAmount)}
            </span>
          </div>
          <div className="mt-1 flex justify-end text-muted-foreground">
            <span>공급가액 {formatKRW(summary.supplyAmount)}</span>
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
