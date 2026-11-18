"use client"

import { ArrowUpDown, Check, ChevronDown, ChevronUp, Copy, Ellipsis, Star, Trash2 } from "lucide-react"
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
import { ContactRow } from "@/components/common/contact-row"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatBizNo } from "@/lib/biz-no"
import { clientBizInfoText } from "@/lib/client-tax-info"
import { formatPhoneNumber } from "@/lib/phone"
import type { ClientRow } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"
import { MAX_PINNED_VEHICLES } from "@/lib/vehicle-list"

import {
  deleteClientAction,
  getClientDispatchCount,
  getClientSaleCount,
  moveClientPinAction,
  toggleClientPinAction,
} from "./actions"
import { SECTION_COLORS } from "@/lib/constants/section-colors"
import { UNDER_STICKY_HEAD } from "@/components/layout/sticky-head"

/** 거래처 목록: 차량 정보와 같은 줄 목록. 줄을 누르면 아래에서 상세·전화·수정·삭제 */
export function ClientList({
  clients,
  contactsByClient,
}: {
  clients: ClientRow[]
  /** 거래처 id → 담당자 목록 (여러 명) */
  contactsByClient: Record<string, { name: string; phone: string | null }[]>
}) {
  /** 담당자 목록이 아직 없으면(예전 자료) 거래처 칸의 담당자 한 명으로 */
  function contactsOf(client: ClientRow): { name: string; phone: string | null }[] {
    const list = contactsByClient[client.id]
    if (list && list.length > 0) return list
    return client.contact_name ? [{ name: client.contact_name, phone: client.contact_phone }] : []
  }
  const [sheetClient, setSheetClient] = useState<ClientRow | null>(null)
  const [target, setTarget] = useState<{
    client: ClientRow
    dispatchCount: number
    saleCount: number
  } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isReordering, setIsReordering] = useState(false)

  // 고정한 거래처는 위에 고정 순서대로, 나머지는 이름순 그대로
  const pinned = clients
    .filter((c) => c.pin_order != null)
    .sort((a, b) => (a.pin_order ?? 0) - (b.pin_order ?? 0))
  const others = clients.filter((c) => c.pin_order == null)

  function handleCopy(client: ClientRow) {
    navigator.clipboard.writeText(clientBizInfoText(client)).then(
      () => toast.success(`복사했어요 · ${client.name} 사업자정보`),
      () => toast.error("복사하지 못했어요")
    )
  }

  function handleTogglePin(client: ClientRow) {
    setSheetClient(null)
    startTransition(async () => {
      try {
        const { error } = await toggleClientPinAction(client.id)
        if (error) toast.error(error)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "고정 실패")
      }
    })
  }

  function handleMove(client: ClientRow, delta: -1 | 1) {
    startTransition(async () => {
      try {
        await moveClientPinAction(client.id, delta)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "순서 변경 실패")
      }
    })
  }

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

  const row = (client: ClientRow, index: number | null) => {
    const isPinned = index !== null
    const people = contactsOf(client)
    const contact = [
      people.length > 1 ? `${people[0].name} 외 ${people.length - 1}명` : people[0]?.name,
      people[0]?.phone ? formatPhoneNumber(people[0].phone) : null,
    ].filter(Boolean)
    return (
      <li
        key={client.id}
        className={cn("relative flex items-center border-b pr-3", isPinned && SECTION_COLORS.client.pinnedRow)}
      >
        <button
          type="button"
          onClick={() => setSheetClient(client)}
          className="flex min-h-15 min-w-0 flex-1 flex-col justify-center px-4 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/60"
        >
          <span className="flex items-center gap-1 text-[15px] leading-snug font-semibold">
            {/* 거래처 고정 표시는 보라색 ★ (차량 정보의 노란 ★과 구별) */}
            {isPinned ? <Star aria-label="고정" className={cn("size-3 shrink-0", SECTION_COLORS.client.star)} /> : null}
            <span className="truncate">{client.name}</span>
          </span>
          {contact.length > 0 ? (
            <span className="mt-0.5 truncate text-[13px] text-muted-foreground">{contact.join(" · ")}</span>
          ) : null}
        </button>
        {!isReordering ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="relative size-10 shrink-0"
            aria-label={`${client.name} 사업자정보 복사`}
            onClick={() => handleCopy(client)}
          >
            <Copy />
          </Button>
        ) : null}
        {isReordering && index !== null ? (
          <div className="flex gap-1">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="size-9"
              aria-label="위로"
              disabled={index === 0 || isPending}
              onClick={() => handleMove(client, -1)}
            >
              <ChevronUp />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="size-9"
              aria-label="아래로"
              disabled={index === pinned.length - 1 || isPending}
              onClick={() => handleMove(client, 1)}
            >
              <ChevronDown />
            </Button>
          </div>
        ) : null}
      </li>
    )
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
      {pinned.length > 0 ? (
        <section className="-mx-4 md:mx-0">
          <div className={cn("sticky z-20 flex h-9 items-center justify-between bg-background px-4 text-sm text-muted-foreground md:static", SECTION_COLORS.client.line, UNDER_STICKY_HEAD)}>
            <span>
              <span className="font-semibold text-foreground">고정</span> {pinned.length}/{MAX_PINNED_VEHICLES}
            </span>
            {pinned.length > 1 ? (
              <button
                type="button"
                aria-pressed={isReordering}
                aria-label={isReordering ? "순서 바꾸기 끝내기" : "순서 바꾸기"}
                onClick={() => setIsReordering((v) => !v)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full",
                  isReordering ? "bg-[#c65a55] text-white" : "bg-muted text-foreground"
                )}
              >
                {isReordering ? <Check className="size-4" /> : <ArrowUpDown className="size-4" />}
              </button>
            ) : null}
          </div>
          <ul>{pinned.map((c, i) => row(c, i))}</ul>
        </section>
      ) : null}

      <section className="-mx-4 md:mx-0">
        <div className={cn("sticky z-20 flex h-11 items-center bg-background px-4 text-sm text-muted-foreground md:static", "border-b", UNDER_STICKY_HEAD)}>
          <span>
            <span className="font-semibold text-foreground">전체</span> {others.length}곳
          </span>
        </div>
        <ul>{others.map((c) => row(c, null))}</ul>
      </section>

      <Sheet open={sheetClient !== null} onOpenChange={(open) => !open && setSheetClient(null)}>
        <SheetContent side="bottom" className="gap-0 pb-6">
          {sheetClient ? (
            <>
              {/* ✕ 옆 ⋯ 메뉴: 가끔 쓰는 고정·삭제는 한 번 더 눌러야 나오게(차량 정보와 같은 방식) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="더보기"
                    className="absolute top-3 right-12 flex size-8 items-center justify-center rounded-md bg-muted text-foreground/80"
                  >
                    <Ellipsis className="size-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem className="h-10" onSelect={() => handleCopy(sheetClient)}>
                    <Copy />
                    사업자정보 복사
                  </DropdownMenuItem>
                  <DropdownMenuItem className="h-10" disabled={isPending} onSelect={() => handleTogglePin(sheetClient)}>
                    <Star className={cn(sheetClient.pin_order != null && SECTION_COLORS.client.star)} />
                    {sheetClient.pin_order != null ? "고정 풀기" : "위에 고정"}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="h-10" variant="destructive" onSelect={() => handleDeleteClick(sheetClient)}>
                    <Trash2 />
                    삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <SheetHeader className="pr-24">
                <SheetTitle>{sheetClient.name}</SheetTitle>
                <SheetDescription>
                  거래처{sheetClient.biz_no ? ` · 사업자 ${formatBizNo(sheetClient.biz_no)}` : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-4">
                {/* 담당자 여러 명: 한 줄에 한 명, 전화 버튼은 줄 끝 */}
                <section>
                  <p className="pb-1 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">담당자</span> {contactsOf(sheetClient).length}명
                  </p>
                  {contactsOf(sheetClient).length === 0 ? (
                    <p className="py-2 text-sm text-muted-foreground">담당자 정보가 없어요. [수정]에서 추가하세요.</p>
                  ) : (
                    <div className="border-t">
                      {contactsOf(sheetClient).map((c, i) => (
                        <ContactRow key={`${c.name}-${i}`} name={c.name} phone={c.phone} />
                      ))}
                    </div>
                  )}
                </section>
                <dl className="flex flex-col gap-1.5 text-sm">
                  {[
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
                <Button variant="outline" className="h-11" asChild>
                  <Link href={`/clients/${sheetClient.id}/edit`}>수정</Link>
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
