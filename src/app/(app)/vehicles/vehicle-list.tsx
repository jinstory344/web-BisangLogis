"use client"

import Link from "next/link"
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Copy, Star } from "lucide-react"
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
import { formatPhoneNumber } from "@/lib/phone"
import type { VehicleRow } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"
import { MAX_PINNED_VEHICLES, vehicleCopyText } from "@/lib/vehicle-list"

import {
  deleteVehicleAction,
  getVehicleDispatchCount,
  moveVehiclePinAction,
  toggleVehiclePinAction,
} from "./actions"

export function VehicleList({
  pinned,
  others,
  sortDirHref,
  sortDir,
}: {
  pinned: VehicleRow[]
  others: VehicleRow[]
  /** "전체" 줄 오른쪽 오름·내림차순 버튼이 갈 주소 */
  sortDirHref: string
  sortDir: "asc" | "desc"
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

  function handleTogglePin(vehicle: VehicleRow) {
    startTransition(async () => {
      try {
        const { error } = await toggleVehiclePinAction(vehicle.id)
        if (error) toast.error(error)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "고정 실패")
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
      onTogglePin={() => handleTogglePin(vehicle)}
      onCopy={() => handleCopy(vehicle)}
    />
  )

  return (
    <>
      {pinned.length > 0 ? (
        <section className="-mx-4 md:mx-0">
          <div className="flex h-9 items-center justify-between px-4 text-sm text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">고정</span> {pinned.length}/
              {MAX_PINNED_VEHICLES}
            </span>
            {pinned.length > 1 ? (
              <button
                type="button"
                className="text-sm underline underline-offset-4"
                onClick={() => setIsReordering((v) => !v)}
              >
                {isReordering ? "완료" : "순서 바꾸기"}
              </button>
            ) : null}
          </div>
          <ul className="border-t">{pinned.map((v, i) => row(v, i))}</ul>
        </section>
      ) : null}

      <section className="-mx-4 md:mx-0">
        <div className="flex h-11 items-center justify-between px-4 text-sm text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">전체</span> {others.length}대
          </span>
          <Link
            href={sortDirHref}
            replace
            scroll={false}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-muted px-3 text-foreground"
          >
            {sortDir === "desc" ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
            {sortDir === "desc" ? "내림차순" : "오름차순"}
          </Link>
        </div>
        <ul className="border-t">{others.map((v) => row(v, null))}</ul>
      </section>

      <Sheet open={sheetVehicle !== null} onOpenChange={(open) => !open && setSheetVehicle(null)}>
        <SheetContent side="bottom" className="gap-0 pb-6">
          {sheetVehicle ? (
            <>
              <SheetHeader className="pr-12">
                <SheetTitle>{sheetVehicle.plate_no}</SheetTitle>
                <SheetDescription>
                  {sheetVehicle.driver_name}
                  {sheetVehicle.driver_phone ? ` · ${formatPhoneNumber(sheetVehicle.driver_phone)}` : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-4">
                <dl className="flex flex-col gap-1.5 text-sm">
                  {[
                    { label: "사업자명", value: sheetVehicle.carrier_name },
                    { label: "차종", value: sheetVehicle.vehicle_type },
                    { label: "메모", value: sheetVehicle.memo },
                  ]
                    .filter((d) => d.value)
                    .map((d) => (
                      <div key={d.label} className="flex gap-3">
                        <dt className="w-16 shrink-0 text-muted-foreground">{d.label}</dt>
                        <dd className="min-w-0 flex-1 break-words whitespace-pre-wrap">{d.value}</dd>
                      </div>
                    ))}
                </dl>
                <div className="grid grid-cols-2 gap-2">
                  {sheetVehicle.driver_phone ? (
                    <Button variant="outline" className="h-11" asChild>
                      <a href={`tel:${sheetVehicle.driver_phone.replace(/\D/g, "")}`}>전화 걸기</a>
                    </Button>
                  ) : (
                    <Button variant="outline" className="h-11" onClick={() => handleCopy(sheetVehicle)}>
                      복사
                    </Button>
                  )}
                  <Button variant="outline" className="h-11" asChild>
                    <Link href={`/vehicles/${sheetVehicle.id}/edit`}>수정</Link>
                  </Button>
                </div>
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
  onTogglePin,
  onCopy,
}: {
  vehicle: VehicleRow
  isPinned: boolean
  reorder: { canUp: boolean; canDown: boolean; onMove: (delta: -1 | 1) => void } | null
  disabled: boolean
  onOpen: () => void
  onTogglePin: () => void
  onCopy: () => void
}) {
  return (
    <li className={cn("relative flex items-center gap-1 border-b px-4 py-2", isPinned && "bg-amber-400/[0.06]")}>
      {/* 줄 전체를 누르면 수정·삭제 메뉴 — 오른쪽 버튼들은 이 위에 따로 놓인다 */}
      <button
        type="button"
        aria-label={`${vehicle.plate_no} 메뉴`}
        className="absolute inset-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/60"
        onClick={onOpen}
      />
      <div className="pointer-events-none min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[15px] leading-snug font-semibold">
          <span className="truncate">{vehicle.plate_no}</span>
          {vehicle.vehicle_type ? (
            <span className="shrink-0 rounded-md border px-1.5 text-[11px] font-normal text-muted-foreground">
              {vehicle.vehicle_type}
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
          {vehicle.driver_name}
          {vehicle.driver_phone ? ` · ${formatPhoneNumber(vehicle.driver_phone)}` : ""}
        </p>
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
        <>
          <button
            type="button"
            aria-label={isPinned ? "고정 풀기" : "위에 고정"}
            aria-pressed={isPinned}
            disabled={disabled}
            onClick={onTogglePin}
            className="relative flex size-10 items-center justify-center rounded-lg text-muted-foreground"
          >
            <Star className={cn("size-5", isPinned && "fill-amber-400 text-amber-400")} />
          </button>
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
        </>
      )}
    </li>
  )
}
