"use client"

import { ChevronRight, Pencil, X } from "lucide-react"
import { useState } from "react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { normalizeCategoryName } from "@/lib/constants/expense-categories"
import { ConfirmDelete } from "@/components/common/confirm-delete"
import { cn } from "@/lib/utils"

import {
  addExpenseCardAction,
  deleteExpenseCardAction,
  moveExpenseCardAction,
  renameExpenseCardAction,
  type CardActionResult,
} from "./card-actions"
import { CategoryAdder } from "./category-adder"
import { CategoryRenamer } from "./category-renamer"
import { moveBounds, OrderMover } from "./order-mover"

/**
 * 결제방법이 카드일 때 나오는 "카드" 한 줄. 누르면 아래에서 카드 이름 판이 올라온다(분류 선택판과 같은 방식).
 * 연필을 누르면 편집: 칸마다 ✕(삭제), 칸을 누르면 순서 옮기기·이름 바꾸기, 아래에 카드 추가.
 */
export function CardPickerSheet({
  cards,
  editable,
  value,
  onChange,
}: {
  cards: string[]
  editable: boolean
  value: string
  onChange: (name: string) => void
}) {
  const [names, setNames] = useState(cards)
  const [open, setOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  /** 서버가 돌려준 새 목록으로 바꾼다. 성공하면 null, 실패하면 오류 문장 */
  function apply(result: CardActionResult): string | null {
    if (!result.ok) return result.error
    setNames(result.names)
    return null
  }

  function pick(name: string) {
    onChange(name)
    setOpen(false)
  }

  // 지울 카드(확인 창을 띄우는 동안)
  const [confirmName, setConfirmName] = useState<string | null>(null)

  async function remove(name: string) {
    const error = apply(await deleteExpenseCardAction(name))
    if (error) window.alert(error)
    else if (selected === name) setSelected(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsEditing(false)
          setSelected(null)
          setOpen(true)
        }}
        className={cn(
          "flex h-11 w-full items-center justify-between border-b border-border text-left text-base",
          value ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className="truncate">{value || "카드 선택 (안 골라도 돼요)"}</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[80svh] gap-0 overflow-y-auto p-0"
        >
          <div className="flex items-center justify-between bg-muted px-4 py-2.5">
            <SheetTitle className="text-base font-medium">카드</SheetTitle>
            <SheetDescription className="sr-only">카드 이름을 누르면 정해져요.</SheetDescription>
            <div className="flex items-center gap-1">
              {editable ? (
                <button
                  type="button"
                  aria-pressed={isEditing}
                  aria-label={isEditing ? "편집 끝내기" : "카드 편집"}
                  onClick={() => {
                    setIsEditing((v) => !v)
                    setSelected(null)
                  }}
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full",
                    isEditing ? "text-red-400" : "text-muted-foreground"
                  )}
                >
                  <Pencil className="size-5" />
                </button>
              ) : null}
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setOpen(false)}
                className="flex size-10 items-center justify-center rounded-full text-muted-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3">
            {!isEditing ? (
              <div className="border-r border-b">
                <button
                  type="button"
                  onClick={() => pick("")}
                  aria-pressed={value === ""}
                  className={cn(
                    "flex h-14 w-full items-center justify-center px-2 text-sm",
                    value === "" ? "font-semibold text-red-400" : "text-muted-foreground"
                  )}
                >
                  선택 안 함
                </button>
              </div>
            ) : null}
            {names.map((name) => (
              <div key={name} className="relative border-r border-b">
                <button
                  type="button"
                  onClick={() => (isEditing ? setSelected(name) : pick(name))}
                  aria-pressed={name === value}
                  className={cn(
                    "flex h-14 w-full items-center justify-center px-2 text-center text-sm break-keep wrap-anywhere",
                    name === value ? "font-semibold text-red-400" : "text-foreground",
                    isEditing && selected === name && "bg-muted"
                  )}
                >
                  {name}
                </button>
                {isEditing ? (
                  <button
                    type="button"
                    aria-label={`${name} 삭제`}
                    onClick={() => setConfirmName(name)}
                    className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {isEditing && selected ? (
            <div className="flex flex-col gap-4 p-4">
              <OrderMover
                key={`move/${selected}`}
                name={selected}
                {...moveBounds(names, selected)}
                onMove={async (direction) => apply(await moveExpenseCardAction(selected, direction))}
              />
              <CategoryRenamer
                key={selected}
                current={selected}
                label={`'${selected}' 카드 이름 바꾸기`}
                note="이미 등록한 지출의 카드 이름도 함께 바뀌어요."
                onCancel={() => setSelected(null)}
                onSave={async (name) => {
                  const error = apply(await renameExpenseCardAction(selected, name))
                  if (!error) {
                    if (value === selected) onChange(normalizeCategoryName(name))
                    setSelected(null)
                  }
                  return error
                }}
              />
            </div>
          ) : isEditing ? (
            <div className="flex flex-col gap-3 p-4">
              <p className="text-xs text-muted-foreground">
                카드를 누르면 이름을 바꾸거나 순서를 옮길 수 있어요.
              </p>
              <CategoryAdder
                label="카드 추가"
                placeholder="새 카드 이름 (예: 신한복지)"
                onAdd={async (name) => apply(await addExpenseCardAction(name))}
              />
            </div>
          ) : (
            <p className="px-4 py-3 text-xs text-muted-foreground">
              {editable
                ? names.length === 0
                  ? "연필을 눌러 쓰는 카드를 추가하세요."
                  : "연필을 누르면 카드를 추가·삭제하고, 이름·순서를 바꿀 수 있어요."
                : "카드를 누르면 정해져요."}
            </p>
          )}
          <ConfirmDelete
            open={confirmName !== null}
            onOpenChange={(open) => !open && setConfirmName(null)}
            title={`'${confirmName ?? ""}' 카드를 목록에서 지울까요?`}
            description="이미 등록한 지출의 카드 이름은 그대로 남아요."
            onConfirm={() => {
              if (confirmName) void remove(confirmName)
              setConfirmName(null)
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
