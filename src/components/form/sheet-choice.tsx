"use client"

import { ChevronRight, X } from "lucide-react"
import { useState } from "react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

import { ChoiceChips, type ChoiceOption } from "./choice-chips"

type SheetChoiceProps<T extends string> = {
  /** 선택판 제목 (예: "지불방법") */
  title: string
  options: readonly ChoiceOption<T>[]
  value: string
  placeholder?: string
  invalid?: boolean
  /** 데스크톱 칩 접근성 이름 */
  "aria-label"?: string
} & (
  | { allowDeselect: true; onChange: (value: T | "") => void }
  | { allowDeselect?: false; onChange: (value: T) => void }
)

/**
 * 고르는 칸 하나 (지불방법·출처·결제방법·하차일·차종 등).
 * 모바일: 고른 값만 한 줄로 보이고, 누르면 아래에서 3열 선택판이 올라온다(지출 분류와 같은 방식).
 *   선택 해제가 되는 칸은 판 위쪽에 "선택 안 함"이 있다.
 * 데스크톱(md 이상): 기존처럼 칩을 늘어놓는다.
 */
export function SheetChoice<T extends string>(props: SheetChoiceProps<T>) {
  const { title, options, value, placeholder = "선택", invalid = false } = props
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)

  function pick(next: T | "") {
    setOpen(false)
    if (next === "") {
      if (props.allowDeselect) props.onChange("")
      return
    }
    ;(props.onChange as (value: T) => void)(next)
  }

  return (
    <>
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={`${title}, 현재 ${selected?.label ?? "없음"}`}
          className={cn(
            "flex min-h-11 w-full items-center justify-between gap-2 border-b text-left text-base",
            invalid ? "border-destructive" : "border-border",
            selected ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" showCloseButton={false} className="gap-0 p-0 pb-4">
            <div className="flex items-center justify-between bg-muted px-4 py-1.5">
              <SheetTitle className="text-base font-medium">{title}</SheetTitle>
              <SheetDescription className="sr-only">누르면 정해져요.</SheetDescription>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setOpen(false)}
                className="-mr-2 flex size-10 items-center justify-center rounded-full text-muted-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-3">
              {options.map((option) => {
                const isSelected = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => pick(option.value)}
                    className={cn(
                      "flex h-14 items-center justify-center border-r border-b px-2 text-center text-sm break-keep [&:nth-child(3n)]:border-r-0",
                      isSelected ? "font-semibold text-red-400" : "text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                )
              })}
              {props.allowDeselect ? (
                <button
                  type="button"
                  onClick={() => pick("")}
                  className="flex h-14 items-center justify-center border-r border-b px-2 text-center text-sm text-muted-foreground [&:nth-child(3n)]:border-r-0"
                >
                  선택 안 함
                </button>
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden md:block">
        {props.allowDeselect ? (
          <ChoiceChips
            aria-label={props["aria-label"] ?? title}
            allowDeselect
            options={options}
            value={value}
            onChange={props.onChange}
          />
        ) : (
          <ChoiceChips
            aria-label={props["aria-label"] ?? title}
            options={options}
            value={value}
            onChange={props.onChange}
          />
        )}
      </div>
    </>
  )
}
