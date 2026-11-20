"use client"

import Link from "next/link"
import { ArrowDownWideNarrow, ArrowUpDown, ArrowUpNarrowWide, Check, ChevronDown, ChevronUp, Copy, Star } from "lucide-react"
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
import { formatPhoneNumber } from "@/lib/phone"
import type { VehicleRow } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"
import { vehicleSpecLabel } from "@/lib/validations/vehicle"
import {
  MAX_PINNED_VEHICLES,
  vehicleCopyText,
  type VehicleDispatchItem,
} from "@/lib/vehicle-list"

import {
  deleteVehicleAction,
  getVehicleDispatchCount,
  moveVehiclePinAction,
  toggleVehiclePinAction,
} from "./actions"
import { VehicleDispatchHistory } from "./vehicle-dispatch-history"
import { SECTION_COLORS } from "@/lib/constants/section-colors"
import { UNDER_STICKY_HEAD } from "@/components/layout/sticky-head"

export function VehicleList({
  pinned,
  others,
  recentDispatches,
  sortDirHref,
  sortDir,
  isNameSort,
}: {
  pinned: VehicleRow[]
  others: VehicleRow[]
  /** 차량 id → 최근 배차 (목록과 함께 미리 받아 둔 것) */
  recentDispatches: Record<string, { items: VehicleDispatchItem[]; total: number; freightSum: number }>
  /** "전체" 줄 오른쪽 오름·내림차순 버튼이 갈 주소 */
  sortDirHref: string
  sortDir: "asc" | "desc"
  /** 지금 차주 이름순으로 보고 있는지 */
  isNameSort: boolean
}) {
  const [sheetVehicle, setSheetVehicle] = useState<VehicleRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{
    vehicle: VehicleRow
    dispatchCount: number
  } | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleCopy(vehicle: VehicleRow) {
    navigator.clipboard.writeText(vehicleCopyText(vehicle)).then(
      () => toast.success(`복사했어요 · ${vehicle.plate_no}`),
      () => toast.error("복사하지 못했어요")
    )
  }

  // 판의 ★: 판을 닫지 않고 바로 고정·해제(누르자마자 별 모양이 바뀌고, 실패하면 되돌린다)
  const [pinOverride, setPinOverride] = useState<Record<string, boolean>>({})
  const sheetCurrent = sheetVehicle
    ? ([...pinned, ...others].find((v) => v.id === sheetVehicle.id) ?? sheetVehicle)
    : null
  const isSheetPinned = sheetCurrent
    ? (pinOverride[sheetCurrent.id] ?? sheetCurrent.pin_order !== null)
    : false

  function handleSheetPin(id: string) {
    const next = !isSheetPinned
    const undo = () => setPinOverride((prev) => ({ ...prev, [id]: !next }))
    setPinOverride((prev) => ({ ...prev, [id]: next }))
    startTransition(async () => {
      try {
        const { error } = await toggleVehiclePinAction(id)
        if (error) {
          toast.error(error)
          undo()
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
        undo()
      }
    })
  }

  function handleMove(vehicle: VehicleRow, delta: -1 | 1) {
    startTransition(async () => {
      try {
        await moveVehiclePinAction(vehicle.id, delta)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "순서 변경 실패")
      }
    })
  }

  async function handleDeleteClick(vehicle: VehicleRow) {
    setSheetVehicle(null)
    const count = await getVehicleDispatchCount(vehicle.id)
    setDeleteTarget({ vehicle, dispatchCount: count })
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return
    const { vehicle } = deleteTarget
    startTransition(async () => {
      try {
        await deleteVehicleAction(vehicle.id)
        toast.success(`"${vehicle.plate_no}" 차량을 삭제했습니다`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "삭제 실패")
      } finally {
        setDeleteTarget(null)
      }
    })
  }

  if (pinned.length === 0 && others.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        등록된 차량이 없습니다.
      </p>
    )
  }

  const row = (vehicle: VehicleRow, index: number | null) => (
    <VehicleRowItem
      key={vehicle.id}
      vehicle={vehicle}
      isPinned={index !== null}
      reorder={
        isReordering && index !== null
          ? {
              canUp: index > 0,
              canDown: index < pinned.length - 1,
              onMove: (delta) => handleMove(vehicle, delta),
            }
          : null
      }
      disabled={isPending}
      onOpen={() => setSheetVehicle(vehicle)}
      onCopy={() => handleCopy(vehicle)}
    />
  )

  return (
    <>
      {pinned.length > 0 ? (
        <section className="-mx-4 md:mx-0">
          <div className={cn("sticky z-20 flex h-9 items-center justify-between bg-background px-4 text-sm text-muted-foreground md:static", SECTION_COLORS.vehicle.line, UNDER_STICKY_HEAD)}>
            <span>
              <span className="font-semibold text-foreground">고정</span> {pinned.length}/
              {MAX_PINNED_VEHICLES}
            </span>
            {pinned.length > 1 ? (
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
          <ul>{pinned.map((v, i) => row(v, i))}</ul>
        </section>
      ) : null}

      <section className="-mx-4 md:mx-0">
        <div className={cn("sticky z-20 flex h-11 items-center justify-between bg-background px-4 text-sm text-muted-foreground md:static", "border-b", UNDER_STICKY_HEAD)}>
          <span>
            <span className="font-semibold text-foreground">전체</span> {others.length}대
          </span>
          {/* 차주 이름 가나다순(↑)·역순(↓). 다른 정렬 중이면 흐리게, 누르면 이름순으로 */}
          <Link
            href={sortDirHref}
            replace
            scroll={false}
            aria-label={
              isNameSort
                ? `차주 이름 ${sortDir === "asc" ? "가나다순" : "역순"}, 누르면 반대로`
                : "차주 이름순으로 보기"
            }
            className={cn(
              "-mr-2 flex size-9 items-center justify-center rounded-full",
              isNameSort ? "text-foreground" : "text-muted-foreground/60"
            )}
          >
            {isNameSort && sortDir === "desc" ? (
              <ArrowDownWideNarrow className="size-[18px]" />
            ) : (
              <ArrowUpNarrowWide className="size-[18px]" />
            )}
          </Link>
        </div>
        <ul>{others.map((v) => row(v, null))}</ul>
      </section>

      <Sheet open={sheetVehicle !== null} onOpenChange={(open) => !open && setSheetVehicle(null)}>
        <SheetContent side="bottom" className="max-h-[90svh] gap-0 overflow-y-auto pb-6">
          {sheetVehicle ? (
            <>
              {/* ✕ 옆 ★: 거래처·메모처럼 누르는 즉시 고정·해제 */}
              <button
                type="button"
                aria-pressed={isSheetPinned}
                aria-label={isSheetPinned ? "고정 풀기" : "맨 위에 고정"}
                disabled={isPending}
                onClick={() => handleSheetPin(sheetVehicle.id)}
                className="absolute top-2.5 right-11 flex h-9 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground"
              >
                <Star className={cn("size-5", isSheetPinned && cn(SECTION_COLORS.vehicle.star, "fill-current"))} />
                {isSheetPinned ? "고정됨" : "고정"}
              </button>
              <SheetHeader className="pr-28">
                <SheetTitle>{sheetVehicle.driver_name}</SheetTitle>
                <SheetDescription>
                  {["차량", sheetVehicle.plate_no, vehicleSpecLabel(sheetVehicle) || null].filter(Boolean).join(" · ")}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-4">
                {/* 거래처 판처럼: 연락처 줄(위아래 선) — 전화 버튼은 줄 끝, 위쪽 ✕와 떨어진 자리 */}
                <div className="border-y">
                  <ContactRow label="차주" name={sheetVehicle.driver_name} phone={sheetVehicle.driver_phone} />
                  {sheetVehicle.memo ? (
                    <div className="flex min-h-11 items-center gap-3 border-t py-1.5 text-sm">
                      <span className="w-14 shrink-0 text-muted-foreground">메모</span>
                      <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">{sheetVehicle.memo}</span>
                    </div>
                  ) : null}
                </div>
                <VehicleDispatchHistory
                  key={sheetVehicle.id}
                  plateNo={sheetVehicle.plate_no}
                  items={recentDispatches[sheetVehicle.id]?.items ?? []}
                  total={recentDispatches[sheetVehicle.id]?.total ?? 0}
                  freightSum={recentDispatches[sheetVehicle.id]?.freightSum ?? 0}
                />
                <Button variant="outline" className="h-11" asChild>
                  <Link href={`/vehicles/${sheetVehicle.id}/edit`}>수정</Link>
                </Button>
                {/* 가끔 쓰는 삭제는 맨 아래 작게 (배차·거래처 판과 같은 자리) */}
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 text-destructive hover:text-destructive"
                  onClick={() => handleDeleteClick(sheetVehicle)}
                >
                  삭제
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              &quot;{deleteTarget?.vehicle.plate_no}&quot; 차량을 삭제할까요?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.dispatchCount > 0
                ? `이 차량과 연결된 배차 이력이 ${deleteTarget.dispatchCount}건 있습니다. 삭제해도 이력은 유지되며, 휴지통에서 30일 내 복구할 수 있습니다.`
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

function VehicleRowItem({
  vehicle,
  isPinned,
  reorder,
  disabled,
  onOpen,
  onCopy,
}: {
  vehicle: VehicleRow
  isPinned: boolean
  reorder: { canUp: boolean; canDown: boolean; onMove: (delta: -1 | 1) => void } | null
  disabled: boolean
  onOpen: () => void
  onCopy: () => void
}) {
  return (
    <li className={cn("relative flex items-center gap-1 border-b px-4 py-2", isPinned && SECTION_COLORS.vehicle.pinnedRow)}>
      {/* 줄 전체를 누르면 수정·삭제 메뉴 — 오른쪽 버튼들은 이 위에 따로 놓인다 */}
      <button
        type="button"
        aria-label={`${vehicle.plate_no} 메뉴`}
        className="absolute inset-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/60"
        onClick={onOpen}
      />
      <div className="pointer-events-none min-w-0 flex-1">
        {/* 첫 줄: 차주 이름(굵게) + 차량번호(보통 굵기) — 사람 이름으로 찾기 쉽게 */}
        <p className="flex min-w-0 items-center gap-2 text-[15px] leading-snug">
          {/* 이름 칸 폭을 3글자에 맞춰 두어 외자·두 글자 이름이어도 차량번호가 같은 자리에서 시작한다 */}
          {isPinned ? (
            <Star aria-label="고정" className={cn("-mr-1 size-3 shrink-0", SECTION_COLORS.vehicle.star)} />
          ) : null}
          <span className="min-w-[3.2em] shrink-0 font-semibold">{vehicle.driver_name}</span>
          <span className="truncate text-[14px]">{vehicle.plate_no}</span>
          {vehicleSpecLabel(vehicle) ? (
            <span className="shrink-0 rounded-md border px-1.5 text-[11px] text-muted-foreground">
              {vehicleSpecLabel(vehicle)}
            </span>
          ) : null}
        </p>
        {vehicle.driver_phone ? (
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground tabular-nums">
            {formatPhoneNumber(vehicle.driver_phone)}
          </p>
        ) : null}
      </div>

      {reorder ? (
        <div className="relative flex gap-1">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-9"
            aria-label="위로"
            disabled={!reorder.canUp || disabled}
            onClick={() => reorder.onMove(-1)}
          >
            <ChevronUp />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-9"
            aria-label="아래로"
            disabled={!reorder.canDown || disabled}
            onClick={() => reorder.onMove(1)}
          >
            <ChevronDown />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="relative size-10"
          aria-label={`${vehicle.plate_no} 복사`}
          onClick={onCopy}
        >
          <Copy />
        </Button>
      )}
    </li>
  )
}
