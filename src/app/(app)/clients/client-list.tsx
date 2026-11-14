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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatBizNo } from "@/lib/biz-no"
import { formatPhoneNumber } from "@/lib/phone"
import type { ClientRow } from "@/lib/supabase/database.types"

import {
  deleteClientAction,
  getClientDispatchCount,
  getClientSaleCount,
} from "./actions"

/** 거래처 목록: 차량 정보와 같은 줄 목록. 줄을 누르면 아래에서 상세·전화·수정·삭제 */
export function ClientList({ clients }: { clients: ClientRow[] }) {
  const [sheetClient, setSheetClient] = useState<ClientRow | null>(null)
  const [target, setTarget] = useState<{
    client: ClientRow
    dispatchCount: number
    saleCount: number
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleDeleteClick(client: ClientRow) {
    setSheetClient(null)
    const [dispatchCount, saleCount] = await Promise.all([
      getClientDispatchCount(client.id),
      getClientSaleCount(client.id),
    ])
    setTarget({ client, dispatchCount, saleCount })
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
      <section className="-mx-4 md:mx-0">
        <div className="flex h-11 items-center px-4 text-sm text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">전체</span> {clients.length}곳
          </span>
        </div>
        <ul className="border-t">
          {clients.map((client) => {
            const contact = [
              client.contact_name,
              client.contact_phone ? formatPhoneNumber(client.contact_phone) : null,
            ].filter(Boolean)
            return (
              <li key={client.id} className="relative border-b">
                <button
                  type="button"
                  onClick={() => setSheetClient(client)}
                  className="flex min-h-15 w-full flex-col justify-center px-4 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/60"
                >
                  <span className="text-[15px] leading-snug font-semibold">{client.name}</span>
                  {contact.length > 0 ? (
                    <span className="mt-0.5 truncate text-[13px] text-muted-foreground">
                      {contact.join(" · ")}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <Sheet open={sheetClient !== null} onOpenChange={(open) => !open && setSheetClient(null)}>
        <SheetContent side="bottom" className="gap-0 pb-6">
          {sheetClient ? (
            <>
              <SheetHeader className="pr-12">
                <SheetTitle>{sheetClient.name}</SheetTitle>
                <SheetDescription>
                  {[sheetClient.contact_name, sheetClient.contact_phone ? formatPhoneNumber(sheetClient.contact_phone) : null]
                    .filter(Boolean)
                    .join(" · ") || "담당자 정보 없음"}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-4">
                <dl className="flex flex-col gap-1.5 text-sm">
                  {[
                    { label: "사업자번호", value: sheetClient.biz_no ? formatBizNo(sheetClient.biz_no) : null },
                    { label: "대표자", value: sheetClient.ceo_name },
                    { label: "주소", value: sheetClient.address },
                    { label: "이메일", value: sheetClient.contact_email },
                    { label: "메모", value: sheetClient.memo },
                  ]
                    .filter((d) => d.value)
                    .map((d) => (
                      <div key={d.label} className="flex gap-3">
                        <dt className="w-18 shrink-0 text-muted-foreground">{d.label}</dt>
                        <dd className="min-w-0 flex-1 break-words whitespace-pre-wrap">{d.value}</dd>
                      </div>
                    ))}
                </dl>
                <div className="grid grid-cols-2 gap-2">
                  {sheetClient.contact_phone ? (
                    <Button variant="outline" className="h-11" asChild>
                      <a href={`tel:${sheetClient.contact_phone.replace(/\D/g, "")}`}>전화 걸기</a>
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    className={sheetClient.contact_phone ? "h-11" : "col-span-2 h-11"}
                    asChild
                  >
                    <Link href={`/clients/${sheetClient.id}/edit`}>수정</Link>
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 text-destructive hover:text-destructive"
                  onClick={() => handleDeleteClick(sheetClient)}
                >
                  삭제
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

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
              {target && target.dispatchCount + target.saleCount > 0
                ? `이 거래처와 연결된 이력이 ${[
                    target.dispatchCount > 0
                      ? `배차 ${target.dispatchCount}건`
                      : null,
                    target.saleCount > 0 ? `매출 ${target.saleCount}건` : null,
                  ]
                    .filter(Boolean)
                    .join(", ")} 있습니다. 삭제해도 이력은 유지되며, 휴지통에서 30일 내 복구할 수 있습니다.`
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
