"use client"

import { ChevronRight, X } from "lucide-react"
import { useState } from "react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import type { SaleClientChoice } from "@/lib/sale-clients"

import { ClientSourcePicker, type PickedSaleClient } from "./client-source-picker"

/**
 * 출처가 "거래처"일 때 거래처 고르기.
 * 모바일: 고른 거래처 이름만 한 줄로 보이고, 누르면 아래에서 거래처 칩·찾기·등록 판이 올라온다
 *   (고르면 바로 닫힌다).
 * 데스크톱(md 이상): 기존처럼 칩을 펼쳐 둔다.
 */
export function ClientSourceRow({
  choices,
  clientId,
  sourceMinor,
  onChange,
}: {
  choices: readonly SaleClientChoice[]
  clientId: string
  sourceMinor: string
  onChange: (client: PickedSaleClient | null) => void
}) {
  const [open, setOpen] = useState(false)
  const name = sourceMinor.trim()

  const picker = (closeOnPick: boolean) => (
    <ClientSourcePicker
      choices={choices}
      clientId={clientId}
      sourceMinor={sourceMinor}
      onChange={(client) => {
        onChange(client)
        if (closeOnPick && client) setOpen(false)
      }}
    />
  )

  return (
    <>
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={`거래처, 현재 ${name || "없음"}`}
          className="flex min-h-11 w-full items-center justify-between gap-2 border-b border-border text-left text-base"
        >
          <span className={name ? "truncate" : "truncate text-muted-foreground"}>
            {name || "거래처 선택"}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="max-h-[80svh] gap-0 overflow-y-auto p-0 pb-6"
          >
            <div className="flex items-center justify-between bg-muted px-4 py-1.5">
              <SheetTitle className="text-base font-medium">거래처</SheetTitle>
              <SheetDescription className="sr-only">
                거래처를 고르면 정해져요. 없는 거래처는 찾아서 등록해요.
              </SheetDescription>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setOpen(false)}
                className="-mr-2 flex size-10 items-center justify-center rounded-full text-muted-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="p-4">{picker(true)}</div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden md:block">{picker(false)}</div>
    </>
  )
}
