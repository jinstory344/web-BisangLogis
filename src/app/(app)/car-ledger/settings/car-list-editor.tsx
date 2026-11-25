"use client"

import { Car, ChevronRight, Plus, Truck } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { ChoiceChips } from "@/components/form/choice-chips"
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
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { CarKind, CarRow } from "@/lib/supabase/database.types"

import { addCarAction, deleteCarAction, updateCarAction } from "../actions"

const KIND_OPTIONS = [
  { value: "business", label: "업무용 (지출에서 가져옴)" },
  { value: "personal", label: "개인 (차계부에만)" },
] as const

const KIND_LABEL: Record<CarKind, string> = { business: "업무용", personal: "개인" }

type Editing = { mode: "add" } | { mode: "edit"; car: CarRow }

/** 차 목록: 누르면 이름·번호판 고치기·삭제, 맨 아래 ＋ 차 추가 */
export function CarListEditor({ cars }: { cars: CarRow[] }) {
  const [editing, setEditing] = useState<Editing | null>(null)

  return (
    <>
      {cars.map((car) => {
        const Icon = car.kind === "business" ? Truck : Car
        return (
          // 차를 누르면 그 차의 차계부(같은 화면), 오른쪽 '수정'은 이름·번호판 고치기·삭제
          <div key={car.id} className="flex min-h-12 w-full items-center border-b text-[15px]">
            <Link
              href={`/car-ledger?car=${car.id}`}
              className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2 pl-4 active:bg-muted"
            >
              <Icon className="size-5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {car.name}
                {car.plate_no ? <span className="text-muted-foreground"> · {car.plate_no}</span> : null}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{KIND_LABEL[car.kind]}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
            <button
              type="button"
              onClick={() => setEditing({ mode: "edit", car })}
              className="shrink-0 px-4 py-3 text-sm text-[#2a95a5] active:bg-muted"
            >
              수정
            </button>
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => setEditing({ mode: "add" })}
        className="flex h-12 w-full items-center gap-3 px-4 text-[15px] text-[#2a95a5] active:bg-muted"
      >
        <Plus className="size-5" />
        차 추가
      </button>

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent side="bottom" className="gap-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {editing ? (
            <CarEditForm
              key={editing.mode === "edit" ? editing.car.id : "add"}
              editing={editing}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}

function CarEditForm({ editing, onDone }: { editing: Editing; onDone: () => void }) {
  const car = editing.mode === "edit" ? editing.car : null
  const [name, setName] = useState(car?.name ?? "")
  const [plateNo, setPlateNo] = useState(car?.plate_no ?? "")
  const [kind, setKind] = useState<CarKind>("personal")
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const result = car
        ? await updateCarAction(car.id, { name, plateNo })
        : await addCarAction({ name, plateNo, kind })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(car ? "저장했어요" : "차를 추가했어요")
      onDone()
    })
  }

  function remove() {
    if (!car) return
    startTransition(async () => {
      const result = await deleteCarAction(car.id)
      setConfirmDelete(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success("차를 지웠어요")
      onDone()
    })
  }

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle>{car ? "차 고치기" : "차 추가"}</SheetTitle>
        <SheetDescription>
          {car
            ? `${KIND_LABEL[car.kind]} 차예요. 종류는 바꿀 수 없어요.`
            : "업무용 트럭은 지출(차량 › 정비·주유비·요소수)을 그대로 보여 줘요."}
        </SheetDescription>
      </SheetHeader>
      <form
        className="flex flex-col gap-3 px-4"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm">
          이름 *
          <Input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} className="h-11 text-base" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          번호판
          <Input
            value={plateNo}
            maxLength={20}
            placeholder="안 적어도 돼요"
            onChange={(e) => setPlateNo(e.target.value)}
            className="h-11 text-base"
          />
        </label>
        {car ? null : (
          <div className="flex flex-col gap-1.5 text-sm">
            종류
            <ChoiceChips options={KIND_OPTIONS} value={kind} onChange={setKind} aria-label="차 종류" />
          </div>
        )}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="h-11" disabled={isPending || name.trim() === ""}>
          {isPending ? "저장 중..." : car ? "저장" : "추가"}
        </Button>
        {car ? (
          <Button
            type="button"
            variant="ghost"
            className="h-10 text-destructive hover:text-destructive"
            disabled={isPending}
            onClick={() => setConfirmDelete(true)}
          >
            이 차 삭제
          </Button>
        ) : null}
      </form>

      <AlertDialog open={confirmDelete} onOpenChange={(open) => !isPending && setConfirmDelete(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>‘{car?.name}’을(를) 지울까요?</AlertDialogTitle>
            <AlertDialogDescription>
              이 차의 기록이 남아 있으면 지울 수 없어요. 교체 주기 표는 함께 안 보이게 돼요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>아니요</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault()
                remove()
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
