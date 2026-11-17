"use client"

import { Check, ChevronDown } from "lucide-react"
import Link from "next/link"
import { useState, type ReactNode } from "react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface ListPickerOption {
  value: string
  label: string
  count: number
  href: string
}

/**
 * 목록 위 한 줄: 왼쪽 "전체 28건", 오른쪽 [고르기 ▾] 펼침 목록 (배차 목록의 거래처 고르기와 같은 모양).
 * 옆으로 밀리는 칩 줄 대신 쓴다(칩 줄을 밀면 달 넘기기와 겹쳐 화면 전체가 밀렸다).
 * trailing: 오른쪽 끝에 붙일 것(예: 자세한 필터 버튼).
 */
export function ListPickerRow({
  options,
  value,
  placeholder,
  trailing,
  amount,
  prefix,
}: {
  options: ListPickerOption[]
  value: string
  /** 아무것도 안 골랐을 때 버튼 글자 (예: "입금 상태") */
  placeholder: string
  trailing?: ReactNode
  /** 건수 오른쪽에 띄워 보여 줄 금액 (예: 분류를 골랐을 때 그 분류 합계) */
  amount?: string
  /** 왼쪽 이름 앞에 붙일 글자 (보고 있는 달, 예: "11월") */
  prefix?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value) ?? options[0]
  const isFiltered = value !== ""

  return (
    <div className="flex min-h-[52px] items-center justify-between gap-2 py-2 text-sm text-muted-foreground">
      <span className="flex min-w-0 items-baseline gap-3">
        <span className="truncate">
          <span className="font-semibold text-foreground">{prefix ? `${prefix} ` : ""}{selected.label}</span> {selected.count}건
        </span>
        {amount ? (
          <span className="shrink-0 text-[15px] font-semibold text-foreground tabular-nums">{amount}</span>
        ) : null}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-9 max-w-44 items-center gap-1 rounded-full px-3.5 text-[13px]",
                isFiltered ? "bg-foreground font-semibold text-background" : "bg-muted text-foreground"
              )}
            >
              <span className="truncate">{isFiltered ? selected.label : placeholder}</span>
              <ChevronDown className="size-4 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="max-h-[60vh] w-56 overflow-y-auto p-1">
            {options.map((option) => (
              <Link
                key={option.value || "all"}
                href={option.href}
                prefetch
                replace
                scroll={false}
                onClick={() => setOpen(false)}
                aria-current={option.value === value ? "true" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-md px-3 text-[15px] active:bg-muted",
                  option.value === value && "font-semibold"
                )}
              >
                <Check className={cn("size-4 shrink-0", option.value === value ? "opacity-100" : "opacity-0")} />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <span className="text-sm text-muted-foreground tabular-nums">{option.count}</span>
              </Link>
            ))}
          </PopoverContent>
        </Popover>
        {trailing}
      </div>
    </div>
  )
}
