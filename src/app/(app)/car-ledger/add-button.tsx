"use client"

import { Droplets, Fuel, Plus, Wrench } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { newCarExpenseHref, newCarLogHref } from "@/lib/car-ledger/url"

const EXPENSE_CHOICES = [
  { minor: "정비", label: "정비", icon: Wrench },
  { minor: "주유비", label: "주유", icon: Fuel },
  { minor: "요소수", label: "요소수", icon: Droplets },
] as const

const FAB_CLASS =
  "fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex size-12 items-center justify-center rounded-full bg-[#c4524e] text-white shadow-lg transition-transform active:scale-95 md:bottom-6"

/**
 * 차계부 오른쪽 아래 ＋.
 * 트럭(지출이 원본): [정비][주유][요소수] 고르기 → 지출 등록 화면(차량 › 그 분류 미리 채움, 저장하면 차계부로).
 * 승용차 등: 차계부 기록 등록 화면.
 */
export function AddButton({
  carId,
  mode,
  defaultKind,
  returnTo,
}: {
  carId: string
  mode: "expense" | "log"
  /** 기록 등록 화면에서 처음 골라 둘 종류 (보고 있던 탭) */
  defaultKind: string
  returnTo: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* 목록 맨 아래가 버튼에 가리지 않게 */}
      <div aria-hidden className="h-16" />
      {mode === "log" ? (
        <Link href={newCarLogHref(carId, defaultKind, returnTo)} aria-label="차계부 기록 등록" className={FAB_CLASS}>
          <Plus className="size-6" aria-hidden />
        </Link>
      ) : (
        <button type="button" aria-label="차 비용 등록" onClick={() => setIsOpen(true)} className={FAB_CLASS}>
          <Plus className="size-6" aria-hidden />
        </button>
      )}

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="gap-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="pr-12">
            <SheetTitle>무엇을 적을까요?</SheetTitle>
            <SheetDescription>지출 등록 화면에 ‘차량’ 분류를 채워서 열어요</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 px-4">
            {EXPENSE_CHOICES.map((choice) => (
              <Link
                key={choice.minor}
                href={newCarExpenseHref(choice.minor, returnTo)}
                onClick={() => setIsOpen(false)}
                className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border bg-card text-sm font-medium active:bg-muted"
              >
                <choice.icon className="size-6 text-muted-foreground" aria-hidden />
                {choice.label}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
