"use client"

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
import { isProtectedLogKind } from "@/lib/car-ledger/constants"
import type { CarItemKind } from "@/lib/supabase/database.types"

import { CategoryAdder } from "../../expenses/category-adder"
import { moveBounds, OrderMover } from "../../expenses/order-mover"
import { addCarItemAction, deleteCarItemAction, moveCarItemAction } from "../actions"

/**
 * 정비 항목·기록 종류 목록 편집 (지출 분류 편집과 같은 방식):
 * 칩을 누르면 골라지고 아래에 순서 옮기기·삭제가 나온다. 맨 끝 ＋로 추가.
 * 기록 종류의 주유·정비는 지울 수 없다.
 */
export function ItemListEditor({
  kind,
  items,
  addLabel,
}: {
  kind: CarItemKind
  items: { id: string; name: string }[]
  addLabel: string
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const selected = items.find((item) => item.id === selectedId) ?? null
  const names = items.map((item) => item.name)
  const canDelete = selected !== null && !(kind === "log" && isProtectedLogKind(selected.name))

  async function add(name: string): Promise<string | null> {
    const result = await addCarItemAction(kind, name)
    return result.ok ? null : result.error
  }

  async function move(direction: -1 | 1): Promise<string | null> {
    if (!selected) return null
    const result = await moveCarItemAction(selected.id, direction)
    return result.ok ? null : result.error
  }

  function confirmDelete() {
    if (!pendingDelete) return
    const target = pendingDelete
    startTransition(async () => {
      const result = await deleteCarItemAction(target.id)
      if (!result.ok) toast.error(result.error)
      else {
        toast.success(`‘${target.name}’을(를) 목록에서 뺐어요`)
        setSelectedId(null)
      }
      setPendingDelete(null)
    })
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isOn = item.id === selectedId
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={isOn}
              onClick={() => setSelectedId(isOn ? null : item.id)}
              className={chipVariants({ selected: isOn })}
            >
              {item.name}
            </button>
          )
        })}
      </div>

      {selected ? (
        <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
          <OrderMover name={selected.name} {...moveBounds(names, selected.name)} onMove={move} />
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-fit text-destructive hover:text-destructive"
              onClick={() => setPendingDelete(selected)}
            >
              ‘{selected.name}’ 삭제
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">‘{selected.name}’은(는) 기본 종류라 지울 수 없어요.</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">이름을 누르면 순서를 바꾸거나 지울 수 있어요.</p>
      )}

      <CategoryAdder label={addLabel} placeholder="이름 (20자까지)" onAdd={add} />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && !isPending && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>‘{pendingDelete?.name}’을(를) 목록에서 뺄까요?</AlertDialogTitle>
            <AlertDialogDescription>이미 적은 기록은 그대로 남아요.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>아니요</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault()
                confirmDelete()
              }}
            >
              {isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
