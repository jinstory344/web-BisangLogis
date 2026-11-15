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
}: {
  options: ListPickerOption[]
  value: string
  /** 아무것도 안 골랐을 때 버튼 글자 (예: "입금 상태") */
  placeholder: string
  trailing?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value) ?? options[0]
  const isFiltered = value !== ""

  return (
    <div className="flex min-h-10 items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        <span className="font-semibold text-foreground">{selected.label}</span> {selected.count}건
      </span>
      <div className="flex items-center gap-1.5">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-9 max-w-44 items-center gap-1 rounded-full px-3.5 text-sm",
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
