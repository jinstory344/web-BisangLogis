"use client"

import { Plus } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { chipVariants } from "@/components/form/choice-chips"
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
import { formatKmNumber } from "@/lib/car-ledger/constants"
import type { CycleRowView } from "@/lib/car-ledger/stats"
import { getWeekdayLabel } from "@/lib/date"
import { cn } from "@/lib/utils"

import {
  addCycleItemAction,
  deleteCycleAction,
  setCycleKmAction,
  setCycleManualAction,
  type CarActionResult,
} from "./actions"

/** 한 줄 5칸: 항목 | 교체일 | 교체 km | 주기 | 다음 교체 */
const GRID = "grid grid-cols-[minmax(0,1fr)_3.4rem_3.9rem_3.9rem_3.9rem] items-center gap-x-1"

/** 올해면 "11/25(화)", 다른 해면 "25/11/25" (좁은 칸에 들어가게) */
function cycleDate(date: string, today: string): string {
  const [, month, day] = date.split("-").map(Number)
  return date.slice(0, 4) === today.slice(0, 4)
    ? `${month}/${day}(${getWeekdayLabel(date)})`
    : `${date.slice(2, 4)}/${month}/${day}`
}

function report(result: CarActionResult, success?: string) {
  if (!result.ok) toast.error(result.error)
  else if (success) toast.success(success)
}

/**
 * 교체 주기 탭 (사용자 확정 모양: 한 줄 5칸).
 * 주기 칸은 눌러서 바로 숫자 입력, 교체일·교체 km를 누르면 직접 고치기 판(기록에서 자동 되돌리기·행 빼기).
 */
export function CycleTable({
  carId,
  rows,
  itemNames,
  today,
}: {
  carId: string
  rows: CycleRowView[]
  /** 정비 항목 목록 (추가할 때 고른다) */
  itemNames: string[]
  today: string
}) {
  const [editingRow, setEditingRow] = useState<CycleRowView | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isPending, startTransition] = useTransition()
  const addable = itemNames.filter((name) => !rows.some((row) => row.item === name))

  function add(item: string) {
    startTransition(async () => {
      const result = await addCycleItemAction(carId, item)
      report(result)
      if (result.ok) setIsAdding(false)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className={cn(GRID, "border-b bg-muted/30 px-2.5 py-2 text-[11px] text-muted-foreground")}>
          <span>항목</span>
          <span>교체일</span>
          <span className="text-right">교체 km</span>
          <span className="text-right">주기</span>
          <span className="text-right">다음 교체</span>
        </div>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">아래 ‘항목 추가’로 교체 주기를 적어 두세요.</p>
        ) : (
          <ul>
            {rows.map((row) => (
              <li key={row.id} className={cn(GRID, "border-t px-2.5 py-1.5 text-xs first:border-t-0")}>
                <span className="line-clamp-2 text-[13px] leading-tight font-medium break-keep wrap-anywhere">
                  {row.item}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingRow(row)}
                  aria-label={`${row.item} 교체일 고치기`}
                  className={cn(
                    "min-h-9 truncate text-left tabular-nums",
                    row.isManual && "underline decoration-dotted underline-offset-2"
                  )}
                >
                  {row.lastDate ? cycleDate(row.lastDate, today) : "-"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRow(row)}
                  aria-label={`${row.item} 교체 km 고치기`}
                  className={cn(
                    "min-h-9 truncate text-right tabular-nums",
                    row.isManual && "underline decoration-dotted underline-offset-2"
                  )}
                >
                  {row.lastKm !== null ? formatKmNumber(row.lastKm) : "-"}
                </button>
                <CycleKmCell key={`${row.id}-${row.cycleKm}`} row={row} />
                <span
                  className={cn(
                    "truncate text-right tabular-nums",
                    row.nextKm !== null ? "font-semibold text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                  )}
                >
                  {row.nextKm !== null ? formatKmNumber(row.nextKm) : "-"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => setIsAdding(true)}
        className={cn(chipVariants({ selected: false }), "w-fit border-dashed")}
      >
        <Plus />
        항목 추가
      </button>

      <Sheet open={isAdding} onOpenChange={setIsAdding}>
        <SheetContent side="bottom" className="max-h-[80dvh] gap-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="pr-12">
            <SheetTitle>교체 주기 항목 추가</SheetTitle>
            <SheetDescription>정비 항목 중에서 골라요 (목록은 ⚙ 설정에서 바꿔요)</SheetDescription>
          </SheetHeader>
          {addable.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">더 추가할 항목이 없어요.</p>
          ) : (
            <div className="flex flex-wrap gap-2 overflow-y-auto px-4 pb-2">
              {addable.map((name) => (
                <button
                  key={name}
                  type="button"
                  disabled={isPending}
                  onClick={() => add(name)}
                  className={chipVariants({ selected: false })}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ManualSheet row={editingRow} onClose={() => setEditingRow(null)} />
    </div>
  )
}

/** 주기 칸: 누르면 그 자리에서 숫자 입력, 칸을 벗어나거나 Enter면 저장 */
function CycleKmCell({ row }: { row: CycleRowView }) {
  const [isEditing, setIsEditing] = useState(false)
  const [text, setText] = useState(row.cycleKm !== null ? formatKmNumber(row.cycleKm) : "")
  const [isPending, startTransition] = useTransition()

  function save() {
    setIsEditing(false)
    const original = row.cycleKm !== null ? formatKmNumber(row.cycleKm) : ""
    if (text.trim() === original) return
    startTransition(async () => {
      const result = await setCycleKmAction(row.id, text)
      report(result)
      if (!result.ok) setText(original)
    })
  }

  if (isEditing) {
    return (
      <Input
        autoFocus
        inputMode="numeric"
        aria-label={`${row.item} 교체 주기 km`}
        value={text}
        onChange={(event) => setText(event.target.value.replace(/[^\d,]/g, ""))}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
          if (event.key === "Escape") {
            setText(row.cycleKm !== null ? formatKmNumber(row.cycleKm) : "")
            setIsEditing(false)
          }
        }}
        className="h-8 px-1.5 text-right text-xs tabular-nums"
      />
    )
  }
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => setIsEditing(true)}
      aria-label={`${row.item} 교체 주기 입력`}
      className={cn(
        "flex h-8 items-center justify-end rounded-md border px-1.5 tabular-nums",
        text ? "border-input" : "border-dashed border-muted-foreground/40 text-muted-foreground"
      )}
    >
      {text || "입력"}
    </button>
  )
}

/** 교체일·교체 km 직접 고치기 판 + "기록에서 자동" + 표에서 빼기 */
function ManualSheet({ row, onClose }: { row: CycleRowView | null; onClose: () => void }) {
  return (
    <Sheet open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        // 날짜 칸에 바로 초점이 가면 폰 날짜 선택이 튀어나와서 막는다
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="gap-0 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        {row ? <ManualForm key={row.id} row={row} onClose={onClose} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function ManualForm({ row, onClose }: { row: CycleRowView; onClose: () => void }) {
  const [date, setDate] = useState(row.lastDate ?? "")
  const [km, setKm] = useState(row.lastKm !== null ? formatKmNumber(row.lastKm) : "")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  function run(action: () => Promise<CarActionResult>, success: string) {
    startTransition(async () => {
      const result = await action()
      report(result, success)
      if (result.ok) onClose()
    })
  }

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle>{row.item} · 최근 교체</SheetTitle>
        <SheetDescription>
          {row.isManual ? "직접 고친 값이에요." : "정비 기록에서 자동으로 가져온 값이에요."} 고치면 그 값으로 보여요.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-3 px-4">
        <label className="flex flex-col gap-1.5 text-sm">
          교체일
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-11 text-base" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          교체 km
          <div className="flex items-center gap-2">
            <Input
              inputMode="numeric"
              value={km}
              placeholder="예: 615,848"
              onChange={(event) => setKm(event.target.value.replace(/[^\d,]/g, ""))}
              className="h-11 flex-1 text-right text-base tabular-nums"
            />
            <span className="text-muted-foreground">km</span>
          </div>
        </label>
        <Button
          type="button"
          className="h-11"
          disabled={isPending}
          onClick={() => run(() => setCycleManualAction(row.id, date, km), "저장했어요")}
        >
          저장
        </Button>
        {row.isManual ? (
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={isPending}
            onClick={() => run(() => setCycleManualAction(row.id, "", ""), "기록에서 자동으로 바꿨어요")}
          >
            기록에서 자동으로 되돌리기
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="h-10 text-destructive hover:text-destructive"
          disabled={isPending}
          onClick={() => setConfirmDelete(true)}
        >
          이 항목을 표에서 빼기
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={(open) => !isPending && setConfirmDelete(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>‘{row.item}’을(를) 교체 주기 표에서 뺄까요?</AlertDialogTitle>
            <AlertDialogDescription>정비 기록은 그대로 남아요. 나중에 다시 추가할 수 있어요.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>아니요</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault()
                run(() => deleteCycleAction(row.id), "표에서 뺐어요")
              }}
            >
              빼기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
