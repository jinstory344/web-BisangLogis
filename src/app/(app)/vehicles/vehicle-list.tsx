"use client"

import Link from "next/link"
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronDown,
  ChevronUp,
  Copy,
  Ellipsis,
  Star,
  Trash2,
} from "lucide-react"
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
import { CallButton } from "@/components/common/call-button"
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
  recentDispatches: Record<string, { items: VehicleDispatchItem[]; total: number }>
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
        <ul className="border-t">{others.map((v) => row(v, null))}</ul>
      </section>

      <Sheet open={sheetVehicle !== null} onOpenChange={(open) => !open && setSheetVehicle(null)}>
        <SheetContent side="bottom" className="max-h-[90svh] gap-0 overflow-y-auto pb-6">
          {sheetVehicle ? (
            <>
              {/* ✕ 옆 ⋯ 메뉴: 가끔 쓰는 고정·삭제는 한 번 더 눌러야 나오게(실수 방지) */}
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
                  <DropdownMenuItem
                    className="h-10"
                    disabled={isPending}
                    onSelect={() => {
                      handleTogglePin(sheetVehicle)
                      setSheetVehicle(null)
                    }}
                  >
                    <Star
                      className={cn(sheetVehicle.pin_order !== null && "fill-amber-400 text-amber-400")}
                    />
                    {sheetVehicle.pin_order !== null ? "고정 풀기" : "위에 고정"}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="h-10" onSelect={() => handleCopy(sheetVehicle)}>
                    <Copy />
                    복사
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="h-10"
                    variant="destructive"
                    onSelect={() => handleDeleteClick(sheetVehicle)}
                  >
                    <Trash2 />
                    삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <SheetHeader className="pr-24">
                <SheetTitle>{sheetVehicle.driver_name}</SheetTitle>
                <div className="flex items-center justify-between gap-2">
                  <SheetDescription>
                    {[
                      sheetVehicle.plate_no,
                      sheetVehicle.driver_phone ? formatPhoneNumber(sheetVehicle.driver_phone) : null,
                      vehicleSpecLabel(sheetVehicle) || null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </SheetDescription>
                  {sheetVehicle.driver_phone ? (
                    <CallButton
                      phone={sheetVehicle.driver_phone}
                      label={`${sheetVehicle.driver_name}에게 전화`}
                    />
                  ) : null}
                </div>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-4">
                <dl className="flex flex-col gap-1.5 text-sm">
                  {[{ label: "메모", value: sheetVehicle.memo }]
                    .filter((d) => d.value)
                    .map((d) => (
                      <div key={d.label} className="flex gap-3">
                        <dt className="w-16 shrink-0 text-muted-foreground">{d.label}</dt>
                        <dd className="min-w-0 flex-1 break-words whitespace-pre-wrap">{d.value}</dd>
                      </div>
                    ))}
                </dl>
                <VehicleDispatchHistory
                  key={sheetVehicle.id}
                  plateNo={sheetVehicle.plate_no}
                  items={recentDispatches[sheetVehicle.id]?.items ?? []}
                  total={recentDispatches[sheetVehicle.id]?.total ?? 0}
                />
                <Button variant="outline" className="h-11" asChild>
                  <Link href={`/vehicles/${sheetVehicle.id}/edit`}>수정</Link>
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
    <li className={cn("relative flex items-center gap-1 border-b px-4 py-2", isPinned && "bg-amber-400/[0.06]")}>
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
            <Star aria-label="고정" className="-mr-1 size-3 shrink-0 fill-amber-400 text-amber-400" />
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
