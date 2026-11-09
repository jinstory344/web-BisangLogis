"use client"

import { cva } from "class-variance-authority"
import { useRef, type KeyboardEvent } from "react"

import { cn } from "@/lib/utils"

/**
 * 입력 폼 칩 공통 스타일 (ChoiceChips · DateQuickPicker · RecentRouteChips).
 * 모바일은 44px 터치 높이, md 이상은 기존 입력칸과 같은 32px.
 */
export const chipVariants = cva(
  "inline-flex min-h-11 min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 md:min-h-8 md:px-3 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      selected: {
        true: "border-primary bg-primary text-primary-foreground",
        false:
          "border-input bg-background text-foreground hover:bg-muted dark:bg-input/30 dark:hover:bg-input/50",
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
)

export interface ChoiceOption<T extends string> {
  value: T
  label: string
}

/** 문자열 상수 배열(SOURCE_MAJOR_OPTIONS 등)을 라벨=값인 칩 옵션으로 바꾼다. */
export function toChoiceOptions<T extends string>(
  values: readonly T[]
): ChoiceOption<T>[] {
  return values.map((value) => ({ value, label: value }))
}

type ChoiceChipsBaseProps<T extends string> = {
  options: readonly ChoiceOption<T>[]
  /** 현재 값. ""(또는 옵션에 없는 값)이면 아무 칩도 선택되지 않은 상태로 보인다. */
  value: string
  id?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
  "aria-labelledby"?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean | "true" | "false"
}

type ChoiceChipsProps<T extends string> = ChoiceChipsBaseProps<T> &
  (
    | {
        /** 선택된 칩을 다시 누르면 해제("")한다 — 선택 입력 필드 전용. */
        allowDeselect: true
        onChange: (value: T | "") => void
      }
    | {
        allowDeselect?: false
        onChange: (value: T) => void
      }
  )

/**
 * 선택지가 적은(2~9개) 단일 선택 필드용 칩 그룹. 드롭다운을 여는 탭 한 번을 줄인다.
 *
 * 접근성: WAI-ARIA radio group 패턴 — role=radiogroup/radio, 선택된 칩(없으면 첫 칩)만
 * Tab으로 들어오고, 방향키·Home/End로 이동하면서 선택한다. Space/Enter는 버튼 기본 동작(클릭).
 * 칩은 줄바꿈되어 좁은 화면에서도 가로 스크롤이 생기지 않는다.
 */
export function ChoiceChips<T extends string>(props: ChoiceChipsProps<T>) {
  const {
    options,
    value,
    id,
    disabled,
    className,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
  } = props
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = options.findIndex((option) => option.value === value)

  function select(next: T) {
    if (next === value) return
    // 판별 유니온의 onChange는 두 시그니처 모두 T를 받는다.
    const onChange = props.onChange as (value: T) => void
    onChange(next)
  }

  function handleClick(option: ChoiceOption<T>) {
    if (option.value === value) {
      // 필수 필드는 다시 눌러도 그대로 둔다 (지출 소분류 "기타"의 직접 입력값 보존 등).
      if (props.allowDeselect) props.onChange("")
      return
    }
    select(option.value)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = options.length
    let nextIndex: number | null = null

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % count
        break
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index - 1 + count) % count
        break
      case "Home":
        nextIndex = 0
        break
      case "End":
        nextIndex = count - 1
        break
      default:
        return
    }

    event.preventDefault()
    chipRefs.current[nextIndex]?.focus()
    select(options[nextIndex].value)
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      aria-disabled={disabled || undefined}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((option, index) => {
        const isSelected = index === selectedIndex
        const isTabStop = selectedIndex === -1 ? index === 0 : isSelected

        return (
          <button
            key={option.value}
            ref={(element) => {
              chipRefs.current[index] = element
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isTabStop ? 0 : -1}
            disabled={disabled}
            data-state={isSelected ? "checked" : "unchecked"}
            className={chipVariants({ selected: isSelected })}
            onClick={() => handleClick(option)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
