"use client"

import Link from "next/link"
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
import { formatBizNo } from "@/lib/biz-no"
import type { ClientRow } from "@/lib/supabase/database.types"

import { deleteClientAction, getClientDispatchCount } from "./actions"

export function ClientList({ clients }: { clients: ClientRow[] }) {
  const [target, setTarget] = useState<{
    client: ClientRow
    dispatchCount: number
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleDeleteClick(client: ClientRow) {
    const count = await getClientDispatchCount(client.id)
    setTarget({ client, dispatchCount: count })
  }

  function handleConfirmDelete() {
    if (!target) return
    const { client } = target
    startTransition(async () => {
      try {
        await deleteClientAction(client.id)
        toast.success(`"${client.name}" 거래처를 삭제했습니다`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "삭제 실패")
      } finally {
        setTarget(null)
      }
    })
  }

  if (clients.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        등록된 거래처가 없습니다.
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
              <TableHead>사업자명</TableHead>
              <TableHead>사업자번호</TableHead>
              <TableHead>대표자</TableHead>
              <TableHead>담당자</TableHead>
              <TableHead>연락처</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.name}</TableCell>
                <TableCell>
                  {client.biz_no ? formatBizNo(client.biz_no) : "-"}
                </TableCell>
                <TableCell>{client.ceo_name ?? "-"}</TableCell>
                <TableCell>{client.contact_name ?? "-"}</TableCell>
                <TableCell>{client.contact_phone ?? "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/clients/${client.id}/edit`}>수정</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(client)}
                    >
                      삭제
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 모바일 카드 리스트 */}
      <div className="flex flex-col gap-2 md:hidden">
        {clients.map((client) => (
          <div key={client.id} className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{client.name}</p>
                <p className="text-sm text-muted-foreground">
                  {client.biz_no ? formatBizNo(client.biz_no) : "사업자번호 미등록"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/clients/${client.id}/edit`}>수정</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteClick(client)}
                >
                  삭제
                </Button>
              </div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              담당자 {client.contact_name ?? "-"} · {client.contact_phone ?? "-"}
            </div>
          </div>
        ))}
      </div>

      <AlertDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              &quot;{target?.client.name}&quot; 거래처를 삭제할까요?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {target && target.dispatchCount > 0
                ? `이 거래처와 연결된 배차 이력이 ${target.dispatchCount}건 있습니다. 삭제해도 이력은 유지되며, 휴지통에서 30일 내 복구할 수 있습니다.`
                : "휴지통으로 이동하며, 30일 내 복구할 수 있습니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isPending}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
