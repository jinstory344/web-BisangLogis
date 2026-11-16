"use client"

import { ChevronRight } from "lucide-react"
import { useState } from "react"

import { ClientSheet } from "@/components/clients/client-sheet"
import type { SaleClientChoice } from "@/lib/sale-clients"

import { ClientSourcePicker, type PickedSaleClient } from "./client-source-picker"

/**
 * 출처가 "거래처"일 때 거래처 고르기.
 * 모바일: 고른 거래처 이름만 한 줄로 보이고, 누르면 배차 폼과 같은 거래처 선택판이 올라온다
 *   (내 거래처 / 타 거래처, 직접 입력은 타 거래처로 추가).
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

        <ClientSheet
          open={open}
          onOpenChange={setOpen}
          selectedId={clientId}
          onPick={(client) => {
            if (client) onChange({ id: client.id, name: client.name })
          }}
          createCategory="OTHER"
        />
      </div>

      <div className="hidden md:block">
        <ClientSourcePicker
          choices={choices}
          clientId={clientId}
          sourceMinor={sourceMinor}
          onChange={onChange}
        />
      </div>
    </>
  )
}
