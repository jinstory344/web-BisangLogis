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
import { formatDateWithWeekday } from "@/lib/date"
import { formatKRW } from "@/lib/money"
import { formatPhoneNumber } from "@/lib/phone"
import type { DispatchRow } from "@/lib/supabase/database.types"

import { deleteDispatchAction } from "./actions"

interface DispatchListProps {
  dispatches: DispatchRow[]
  clientNameMap: Record<string, string>
  totalCount: number
  page: number
  totalPages: number
}

/** 배차(차량 섭외) 목록 — 금액은 다루지 않는다. 실제 수익은 매출 페이지 담당. */
export function DispatchList({
  dispatches,
  clientNameMap,
  totalCount,
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
      {/* 데스크톱 표 */}
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>날짜</TableHead>
              <TableHead>거래처</TableHead>
              <TableHead>담당자</TableHead>
              <TableHead>경로</TableHead>
              <TableHead className="text-right">파렛</TableHead>
              <TableHead className="text-right">중량</TableHead>
              <TableHead>차량정보</TableHead>
              <TableHead>전화번호</TableHead>
              <TableHead className="text-right">운임</TableHead>
              <TableHead className="text-right">수수료</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dispatches.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{formatDateWithWeekday(d.dispatch_date)}</TableCell>
                <TableCell>
                  {d.client_id ? clientNameMap[d.client_id] ?? "-" : "-"}
                </TableCell>
                <TableCell>{d.contact_name ?? "-"}</TableCell>
                <TableCell>
                  {d.origin} → {d.destination}
                </TableCell>
                <TableCell className="text-right">
                  {d.pallet_count ?? "-"}
                </TableCell>
                <TableCell className="text-right">
                  {d.weight_ton != null ? `${d.weight_ton}톤` : "-"}
                </TableCell>
                <TableCell>
                  {d.plate_no_snapshot ?? "-"}
                  {d.driver_name_snapshot ? ` (${d.driver_name_snapshot})` : ""}
                </TableCell>
                <TableCell>{formatPhoneNumber(d.driver_phone_snapshot)}</TableCell>
                <TableCell className="text-right">
                  {d.freight_amount != null ? formatKRW(d.freight_amount) : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {formatKRW(d.fee_amount)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dispatches/${d.id}`}>상세</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dispatches/${d.id}/edit`}>수정</Link>
                    </Button>
                    <Button
                      variant="outline"
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
        <div className="border-t bg-muted/30 p-3 text-sm font-medium">
          <span>{totalCount}건</span>
        </div>
      </div>

      {/* 모바일 카드 리스트 */}
      <div className="flex flex-col gap-2 md:hidden">
        {dispatches.map((d) => (
          <div key={d.id} className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="inline-block rounded bg-muted px-1.5 py-0.5 text-sm text-muted-foreground italic">
                  {formatDateWithWeekday(d.dispatch_date)}
                </p>
                <p className="font-bold">
                  {d.origin} → {d.destination}
                </p>
                <p className="text-sm text-foreground">
                  운임{" "}
                  {d.freight_amount != null
                    ? formatKRW(d.freight_amount)
                    : "-"}
                  {d.fee_amount > 0
                    ? ` / 수수료 ${formatKRW(d.fee_amount)}`
                    : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {d.plate_no_snapshot ?? "-"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {d.driver_name_snapshot ?? "-"}
                  {d.driver_phone_snapshot
                    ? ` ${formatPhoneNumber(d.driver_phone_snapshot)}`
                    : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {d.client_id ? clientNameMap[d.client_id] ?? "-" : "-"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.contact_name ?? "-"}
                </p>
              </div>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dispatches/${d.id}`}>상세</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dispatches/${d.id}/edit`}>수정</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(d)}
              >
                삭제
              </Button>
            </div>
          </div>
        ))}
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <span>{totalCount}건</span>
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
