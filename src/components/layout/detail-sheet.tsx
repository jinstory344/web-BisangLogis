"use client"

import { useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

/** 컴퓨터 화면(가로 1024px 이상)인지 — 이 크기부터 오른쪽 상세 패널을 쓴다 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)")
    const update = () => setIsDesktop(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return isDesktop
}

/**
 * 목록의 줄을 누르면 뜨는 상세 판 (사용자 고른 시안 C, 2026-11-20).
 * - 휴대폰: 지금처럼 아래에서 올라오는 판.
 * - 컴퓨터: 오른쪽 400px 고정 패널. 목록을 가리지 않고(main이 오른쪽을 비켜 줌), 다른 줄을 누르면 바로 바뀐다.
 *   아무것도 안 골랐을 때는 안내 글을 보여 준다.
 */
export function DetailSheet({
  open,
  onOpenChange,
  className,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 휴대폰 판에 쓰던 클래스 그대로 */
  className?: string
  children: ReactNode
}) {
  const isDesktop = useIsDesktop()
  return (
    <>
      {/* main이 이 표시를 보고 컴퓨터 화면에서 오른쪽 400px를 비운다(app-shell) */}
      <span data-detail-panel hidden />
      {/* 목록을 감싼 부품(달 넘기기 등)이 위치 기준을 바꿀 수 있어 화면 맨 바깥(body)에 그린다 */}
      {isDesktop && !open
        ? createPortal(
            <aside className="fixed inset-y-0 right-0 z-30 flex w-[400px] items-center justify-center border-l bg-background px-8 text-center text-sm text-muted-foreground">
              줄을 누르면 여기에 자세히 보여요
            </aside>,
            document.body
          )
        : null}
      {/* 컴퓨터에서는 모달이 아니게: 목록을 계속 누를 수 있고, 다른 줄을 누르면 그 줄로 바뀐다 */}
      <Sheet open={open} onOpenChange={onOpenChange} modal={!isDesktop}>
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          className={cn(
            className,
            isDesktop &&
              "max-h-none gap-0 overflow-y-auto pt-2 shadow-none data-[side=right]:w-[400px] data-[side=right]:sm:max-w-none data-open:animate-none data-closed:animate-none"
          )}
        >
          {children}
        </SheetContent>
      </Sheet>
    </>
  )
}
