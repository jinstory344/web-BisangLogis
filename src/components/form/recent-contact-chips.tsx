"use client"

import { useId } from "react"

import { formatPhoneNumber } from "@/lib/phone"
import { cn } from "@/lib/utils"

import { chipVariants } from "./choice-chips"

interface RecentContactChipsProps {
  contacts: readonly string[]
  /** 현재 입력된 연락처 — 같은 번호(숫자만 비교)의 칩을 선택 상태로 보여준다. */
  value: string
  onSelect: (contact: string) => void
}

function digitsOf(phone: string): string {
  return phone.replace(/\D/g, "")
}

/**
 * 매출 폼 연락처 입력 아래의 "최근 연락처" 칩. 같은 출처·소분류로 등록한 이전 매출의
 * 연락처를 보여 주고, 누르면 연락처 칸을 채운다. 같은 거래처라도 담당자가 건마다 달라서
 * 자동으로 채우지는 않는다. 후보가 없으면 아무것도 그리지 않는다.
 */
export function RecentContactChips({
  contacts,
  value,
  onSelect,
}: RecentContactChipsProps) {
  const labelId = useId()

  if (contacts.length === 0) return null

  const currentDigits = digitsOf(value)

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={labelId} className="text-xs font-medium text-muted-foreground">
        최근 연락처
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        // RecentRouteChips와 같은 가로 스크롤 줄 (contain:inline-size는 칩 너비가 화면 전체를 넓히지 않게 한다).
        className="no-scrollbar -mx-4 -my-1 flex gap-2 overflow-x-auto px-4 py-1 [contain:inline-size] md:mx-0 md:my-0 md:flex-wrap md:overflow-visible md:px-0 md:py-0 md:[contain:none]"
      >
        {contacts.map((contact) => {
          const isActive =
            currentDigits !== "" && digitsOf(contact) === currentDigits

          return (
            <button
              key={digitsOf(contact)}
              type="button"
              aria-pressed={isActive}
              className={cn(chipVariants({ selected: isActive }), "tabular-nums")}
              onClick={() => onSelect(formatPhoneNumber(contact))}
            >
              {formatPhoneNumber(contact)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
