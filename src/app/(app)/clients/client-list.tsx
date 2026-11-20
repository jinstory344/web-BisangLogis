"use client"

import { ArrowUpDown, Check, ChevronDown, ChevronRight, ChevronUp, Copy, Star } from "lucide-react"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatBizNo } from "@/lib/biz-no"
import { clientGroupMap, collapseByGroup, type ClientUnit } from "@/lib/client-groups"
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
import { useSectionOpen } from "@/components/list/use-section-open"

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
  const [isOthersOpen, toggleOthers] = useSectionOpen()

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  // 고정한 거래처는 위에 고정 순서대로, 나머지는 이름순 그대로
  const pinned = clients
    .filter((c) => c.pin_order != null)
    .sort((a, b) => (a.pin_order ?? 0) - (b.pin_order ?? 0))

  // 이름 첫 단어가 같은 거래처(조은푸드 육대장·이화수)는 "조은푸드" 한 줄로 묶는다.
  // 묶음 안에 하나라도 고정돼 있으면 묶음 전체가 고정 칸에 보인다.
  const groupOf = clientGroupMap(clients)
  const membersOf = (name: string) => clients.filter((c) => groupOf.get(c.id) === name)
  const pinnedGroups = new Set(pinned.map((c) => groupOf.get(c.id)).filter((n): n is string => !!n))
  const withAllMembers = (units: ClientUnit<ClientRow>[]) =>
    units.map((u) => (u.kind === "group" ? { ...u, items: membersOf(u.name) } : u))
  const pinnedUnits = withAllMembers(collapseByGroup(pinned, groupOf))
  const others = clients.filter((c) => c.pin_order == null && !pinnedGroups.has(groupOf.get(c.id) ?? ""))
  const otherUnits = withAllMembers(collapseByGroup(others, groupOf))

  function handleCopy(client: ClientRow) {
    navigator.clipboard.writeText(clientBizInfoText(client)).then(
      () => toast.success(`복사했어요 · ${client.name} 사업자정보`),
      () => toast.error("복사하지 못했어요")
    )
  }

  function handleTogglePin(ids: string[]) {
    setSheetClient(null)
    startTransition(async () => {
      try {
        const { error } = await toggleClientPinAction(ids)
        if (error) toast.error(error)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "고정 실패")
      }
    })
  }

  // 판의 ★: 판을 닫지 않고 바로 고정·해제(누르자마자 별 모양이 바뀌고, 실패하면 되돌린다)
  const [pinOverride, setPinOverride] = useState<Record<string, boolean>>({})
  const sheetCurrent = sheetClient ? (clients.find((c) => c.id === sheetClient.id) ?? sheetClient) : null
  const isSheetPinned = sheetCurrent
    ? (pinOverride[sheetCurrent.id] ?? sheetCurrent.pin_order != null)
    : false

  function handleSheetPin(id: string) {
    const next = !isSheetPinned
    setPinOverride((prev) => ({ ...prev, [id]: next }))
    startTransition(async () => {
      try {
        const { error } = await toggleClientPinAction([id])
        if (error) {
          toast.error(error)
          setPinOverride((prev) => ({ ...prev, [id]: !next }))
          return
        }
        toast.success(next ? "맨 위에 고정했어요" : "고정을 풀었어요")
        // 서버 값이 새로 들어왔으니 임시 표시는 지운다
        setPinOverride((prev) => {
          const rest = { ...prev }
          delete rest[id]
          return rest
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "고정 실패")
        setPinOverride((prev) => ({ ...prev, [id]: !next }))
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

  const row = (client: ClientRow, index: number | null, inGroup = false) => {
    const isPinned = index !== null
    const people = contactsOf(client)
    const contact = [
      people.length > 1 ? `${people[0].name} 외 ${people.length - 1}명` : people[0]?.name,
      people[0]?.phone ? formatPhoneNumber(people[0].phone) : null,
    ].filter(Boolean)
    return (
      <li
        key={client.id}
        className={cn("relative flex items-center border-b pr-3", (isPinned || inGroup) && SECTION_COLORS.client.pinnedRow)}
      >
        <button
          type="button"
          onClick={() => setSheetClient(client)}
          className={cn(
            "flex min-h-15 min-w-0 flex-1 flex-col justify-center py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/60",
            inGroup ? "pr-4 pl-9" : "px-4"
          )}
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
              disabled={index === pinnedUnits.length - 1 || isPending}
              onClick={() => handleMove(client, 1)}
            >
              <ChevronDown />
            </Button>
          </div>
        ) : null}
      </li>
    )
  }

  const moveButtons = (index: number, id: string) => (
    <div className="flex gap-1">
      <Button type="button" variant="secondary" size="icon" className="size-9" aria-label="위로"
        disabled={index === 0 || isPending} onClick={() => startTransition(() => moveClientPinAction(id, -1))}>
        <ChevronUp />
      </Button>
      <Button type="button" variant="secondary" size="icon" className="size-9" aria-label="아래로"
        disabled={index === pinnedUnits.length - 1 || isPending} onClick={() => startTransition(() => moveClientPinAction(id, 1))}>
        <ChevronDown />
      </Button>
    </div>
  )

  /** 묶음 한 줄: 누르면 아래에 거래처들이 펼쳐지고, ★로 묶음 전체를 고정·해제 */
  const groupRow = (name: string, items: ClientRow[], index: number | null) => {
    const isPinned = index !== null
    const isOpen = openGroups.has(name)
    const pinnedMember = items.find((c) => c.pin_order != null)
    return [
      <li key={`group-${name}`} className={cn("relative flex items-center border-b pr-3", isPinned && SECTION_COLORS.client.pinnedRow)}>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() =>
            setOpenGroups((prev) => {
              const next = new Set(prev)
              if (next.has(name)) next.delete(name)
              else next.add(name)
              return next
            })
          }
          className="flex min-h-15 min-w-0 flex-1 items-center gap-1.5 px-4 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/60"
        >
          {isPinned ? <Star aria-label="고정" className={cn("size-3 shrink-0", SECTION_COLORS.client.star)} /> : null}
          <span className="truncate text-[15px] leading-snug font-semibold">{name}</span>
          <span className="shrink-0 text-[13px] text-muted-foreground">{items.length}곳</span>
          {isOpen ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
        </button>
        {isReordering && index !== null && pinnedMember ? (
          moveButtons(index, pinnedMember.id)
        ) : null}
      </li>,
      ...(isOpen && !isReordering ? items.map((c) => row(c, null, true)) : []),
      ...(isOpen && !isReordering
        ? [
            <li key={`group-pin-${name}`} className={cn("border-b", SECTION_COLORS.client.pinnedRow)}>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleTogglePin(items.map((c) => c.id))}
                className="flex h-11 w-full items-center gap-1.5 pl-9 text-left text-[13px] text-muted-foreground active:bg-muted/60"
              >
                <Star className={cn("size-3.5", isPinned && SECTION_COLORS.client.star, isPinned && "fill-current")} />
                {isPinned ? `${name} 묶음 고정 풀기` : `${name} 묶음 위에 고정`}
              </button>
            </li>,
          ]
        : []),
    ]
  }

  const unitRows = (units: ClientUnit<ClientRow>[], pinnedSection: boolean) =>
    units.flatMap((u, i) =>
      u.kind === "group" ? groupRow(u.name, u.items, pinnedSection ? i : null) : [row(u.item, pinnedSection ? i : null)]
    )

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
            {pinnedUnits.length > 1 ? (
              <button
                type="button"
                aria-pressed={isReordering}
                aria-label={isReordering ? "순서 바꾸기 끝내기" : "순서 바꾸기"}
                onClick={() => setIsReordering((v) => !v)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full",
                  isReordering ? "text-[#e06a64]" : "text-foreground/80"
                )}
              >
                {isReordering ? <Check className="size-5" strokeWidth={2.5} /> : <ArrowUpDown className="size-[18px]" />}
              </button>
            ) : null}
          </div>
          <ul>{unitRows(pinnedUnits, true)}</ul>
        </section>
      ) : null}

      <section className="-mx-4 md:mx-0">
        <div className={cn("sticky z-20 flex h-11 items-center bg-background px-4 text-sm text-muted-foreground md:static", "border-b", UNDER_STICKY_HEAD)}>
          {/* 누르면 전체 목록을 접고 펴기(접은 상태는 휴대폰에 기억) */}
          <button
            type="button"
            aria-expanded={isOthersOpen}
            onClick={toggleOthers}
            className="-ml-1 flex h-9 items-center gap-1 rounded-md px-1"
          >
            <span className="font-semibold text-foreground">전체</span> {others.length}곳
            {isOthersOpen ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )}
          </button>
        </div>
        {isOthersOpen ? <ul>{unitRows(otherUnits, false)}</ul> : null}
      </section>

      <Sheet open={sheetClient !== null} onOpenChange={(open) => !open && setSheetClient(null)}>
        <SheetContent side="bottom" className="gap-0 pb-6">
          {sheetClient ? (
            <>
              {/* ✕ 옆 ★: 메모처럼 누르는 즉시 고정·해제 */}
              <button
                type="button"
                aria-pressed={isSheetPinned}
                aria-label={isSheetPinned ? "고정 풀기" : "맨 위에 고정"}
                disabled={isPending}
                onClick={() => handleSheetPin(sheetClient.id)}
                className="absolute top-2.5 right-11 flex h-9 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground"
              >
                <Star className={cn("size-5", isSheetPinned && cn(SECTION_COLORS.client.star, "fill-current"))} />
                {isSheetPinned ? "고정됨" : "고정"}
              </button>
              <SheetHeader className="pr-28">
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
                {/* 가끔 쓰는 삭제는 맨 아래 작게 (배차 판과 같은 자리) */}
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
