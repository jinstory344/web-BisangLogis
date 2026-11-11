"use client"

import { X } from "lucide-react"

import { cn } from "@/lib/utils"

interface RemovableCategoryChipsProps {
  names: readonly string[]
  /** 지금 고른 이름 (이름을 누르면 onSelect, 편집 중에도 대분류를 골라 그 소분류를 편집할 수 있다) */
  value: string
  onSelect: (name: string) => void
  /** 지울 수 없는 이름 (소분류 "기타") — ✕ 없이 보인다. */
  protectedNames?: readonly string[]
  onRemove: (name: string) => void
  "aria-label": string
}

/** 분류 편집 모드의 칩 줄: 이름을 누르면 고르고, 이름 옆 ✕를 누르면 지운다(확인 창은 호출하는 쪽). */
export function RemovableCategoryChips({
  names,
  value,
  onSelect,
  protectedNames = [],
  onRemove,
  "aria-label": ariaLabel,
}: RemovableCategoryChipsProps) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {names.map((name) => {
        const isProtected = protectedNames.includes(name)
        const isSelected = value === name
        return (
          <span
            key={name}
            className={cn(
              "inline-flex items-center rounded-full border text-sm font-medium",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background"
            )}
          >
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(name)}
              className={cn(
                "min-h-11 rounded-full pl-4 md:min-h-8 md:pl-3",
                isProtected ? "pr-4 md:pr-3" : "pr-1"
              )}
            >
              {name}
            </button>
            {isProtected ? null : (
              <button
                type="button"
                aria-label={`${name} 삭제`}
                onClick={() => onRemove(name)}
                className={cn(
                  "mr-1 flex size-9 items-center justify-center rounded-full md:size-6",
                  isSelected
                    ? "text-primary-foreground/80 hover:bg-primary-foreground/20"
                    : "text-muted-foreground hover:bg-muted hover:text-destructive"
                )}
              >
                <X className="size-4" />
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}
