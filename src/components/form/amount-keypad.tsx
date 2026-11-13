"use client"

import { Delete, X } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import {
  applyKeypadKey,
  evaluateKeypad,
  formatKeypadExpr,
  keypadExprFromValue,
  type KeypadKey,
} from "@/lib/keypad"
import { formatKRW } from "@/lib/money"
import { cn } from "@/lib/utils"

type AmountKeypadFieldProps = {
  /** 키패드 위 회색 띠에 보이는 이름 (예: "금액 (공급가액)") */
  title: string
  /** 금액 글자 색·굵기 (매출 파랑, 지출 빨강 등) */
  amountClassName?: string
  /** 금액 바로 오른쪽에 작게 붙는 글 (세액·합계, 수수료 등) */
  extra?: ReactNode
  /** 화면이 열리자마자 키패드를 띄운다 (새 등록에서 금액이 비어 있을 때) */
  autoOpen?: boolean
  /** "다음"을 누르면 부른다. 없으면 버튼 이름이 "확인"이고 닫기만 한다. */
  onNext?: () => void
  invalid?: boolean
  placeholder?: string
} & (
  | { nullable: true; value: number | null; onChange: (value: number | null) => void }
  | { nullable?: false; value: number; onChange: (value: number) => void }
)

const KEYS: { key: KeypadKey | "next"; label: ReactNode; tone?: "op" | "ok" }[] = [
  { key: "7", label: "7" },
  { key: "8", label: "8" },
  { key: "9", label: "9" },
  { key: "clear", label: "C", tone: "op" },
  { key: "4", label: "4" },
  { key: "5", label: "5" },
  { key: "6", label: "6" },
  { key: "plus", label: "+", tone: "op" },
  { key: "1", label: "1" },
  { key: "2", label: "2" },
  { key: "3", label: "3" },
  { key: "back", label: <Delete className="size-7" aria-label="지우기" />, tone: "op" },
  { key: "00", label: "00" },
  { key: "0", label: "0" },
  { key: "000", label: "000" },
  { key: "next", label: "", tone: "ok" },
]

/**
 * 모바일 등록 화면의 금액 한 줄 + 계산기 키패드 (가계부 앱 방식).
 * 줄을 누르면 폰 키보드 대신 아래에서 키패드가 올라온다: 숫자, 00·000, 오른쪽 줄은 위에서부터
 * C(전체 지우기) · +(여러 금액 더하기) · ⌫(지우기, 다음 바로 위) · 다음/확인. 누를 때마다 값이 바로 폼에 들어가 세액·합계가 즉시 바뀐다.
 * 키패드 밖을 누르면 닫히고 그 누른 칸으로 그대로 넘어간다.
 * 데스크톱(md 이상)은 이 부품 대신 기존 AmountInput을 쓴다 (폼에서 md:hidden으로 나눔).
 */
export function AmountKeypadField(props: AmountKeypadFieldProps) {
  const {
    title,
    amountClassName,
    extra,
    autoOpen = false,
    onNext,
    invalid = false,
    placeholder = "0",
    nullable,
    value,
  } = props
  const [open, setOpen] = useState(false)
  const [expr, setExpr] = useState("")
  const rowRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  function emit(nextExpr: string) {
    const next = evaluateKeypad(nextExpr)
    if (nullable) props.onChange(next)
    else props.onChange(next ?? 0)
  }

  function openKeypad() {
    // 다른 칸의 폰 키보드가 떠 있으면 내린다
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    setExpr(keypadExprFromValue(value))
    setOpen(true)
  }

  // 새 등록 화면: 열자마자 금액부터 (화면 그리기가 끝난 뒤 한 번만)
  const autoOpened = useRef(false)
  useEffect(() => {
    if (!autoOpen || autoOpened.current) return
    autoOpened.current = true
    // 데스크톱 폭에서는 띄우지 않는다
    if (window.matchMedia("(min-width: 48rem)").matches) return
    setExpr(keypadExprFromValue(value))
    setOpen(true)
  }, [autoOpen, value])

  // 키패드 밖을 누르면 닫는다 (누른 칸은 그대로 눌린다)
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || rowRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    // 금액 줄이 키패드에 가리지 않게
    rowRef.current?.scrollIntoView({ block: "nearest" })
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  function press(key: KeypadKey | "next") {
    if (key === "next") {
      setOpen(false)
      onNext?.()
      return
    }
    const nextExpr = applyKeypadKey(expr, key)
    if (nextExpr === expr) return
    setExpr(nextExpr)
    emit(nextExpr)
  }

  const shownValue = open
    ? formatKeypadExpr(expr)
    : value !== null && (value > 0 || (nullable && value === 0))
      ? formatKRW(value).replace(/원$/, "")
      : ""

  return (
    <>
      <button
        ref={rowRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openKeypad())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${title} 입력, 현재 ${shownValue || "없음"}`}
        className={cn(
          "flex min-h-11 w-full items-center gap-2 border-b text-left tabular-nums transition-colors",
          open ? "border-red-400" : invalid ? "border-destructive" : "border-border"
        )}
      >
        {shownValue ? (
          <span className={cn("shrink-0 text-base font-semibold whitespace-nowrap", amountClassName)}>
            {shownValue}
            {open && expr.endsWith("+") ? "" : "원"}
          </span>
        ) : (
          <span className="text-base text-muted-foreground">{placeholder}</span>
        )}
        {extra ? (
          <span className="min-w-0 truncate text-xs text-muted-foreground">{extra}</span>
        ) : null}
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={`${title} 키패드`}
              className="fixed inset-x-0 bottom-0 z-[60] bg-background pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.35)] md:hidden"
            >
              <div className="flex h-11 items-center justify-between bg-muted px-4 text-sm text-muted-foreground">
                <span>{title}</span>
                <button
                  type="button"
                  aria-label="키패드 닫기"
                  onClick={() => setOpen(false)}
                  className="-mr-2 flex size-10 items-center justify-center"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="grid grid-cols-4">
                {KEYS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => press(item.key)}
                    className={cn(
                      "flex h-16 items-center justify-center border-r border-b text-2xl tabular-nums transition-colors select-none active:bg-muted [&:nth-child(4n)]:border-r-0",
                      item.tone === "op" && "bg-muted/40 text-foreground",
                      item.tone === "ok" &&
                        "bg-[#c4524e] text-xl font-semibold text-white active:bg-[#a9433f]"
                    )}
                  >
                    {item.key === "next" ? (onNext ? "다음" : "확인") : item.label}
                  </button>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
