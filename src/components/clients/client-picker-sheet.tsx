"use client"

import { ChevronRight } from "lucide-react"
import { useState } from "react"

import type { ClientSearchResult } from "@/app/(app)/clients/actions"
import { ClientCombobox } from "@/components/clients/client-combobox"
import { ClientSheet } from "@/components/clients/client-sheet"
import { cn } from "@/lib/utils"

/**
 * 거래처 고르기 (배차 폼).
 * 모바일: 고른 거래처만 한 줄로 보이고, 누르면 아래에서 거래처 선택판이 올라온다.
 *   "직접 입력"으로 고르면 바로 내 거래처로 추가된다.
 * 데스크톱(md 이상): 기존 거래처 상자 그대로.
 */
export function ClientPickerSheet({
  value,
  onChange,
  invalid = false,
}: {
  value: ClientSearchResult | null
  onChange: (client: ClientSearchResult | null) => void
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={`거래처, 현재 ${value?.name ?? "없음"}`}
          className={cn(
            "flex min-h-11 w-full items-center justify-between gap-2 border-b text-left text-base",
            invalid ? "border-destructive" : "border-border",
            value ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <span className="truncate">{value?.name ?? "거래처 선택"}</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
        <ClientSheet
          open={open}
          onOpenChange={setOpen}
          selectedId={value?.id ?? ""}
          onPick={(client) => {
            if (client) onChange(client)
          }}
          createCategory="MINE"
        />
      </div>

      <div className="hidden md:block">
        <ClientCombobox value={value} onChange={onChange} />
      </div>
    </>
  )
}
