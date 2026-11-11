"use client"

import { useId } from "react"

import { formatPhoneNumber } from "@/lib/phone"
import { isSameContact, type RecentContact } from "@/lib/quick-entry"
import { cn } from "@/lib/utils"

import { chipVariants } from "./choice-chips"

interface RecentContactChipsProps {
  contacts: readonly RecentContact[]
  /** 현재 입력된 담당자 — 같은 사람(이름+번호, 번호는 숫자만 비교)의 칩을 선택 상태로 보여준다. */
  value: RecentContact
  onSelect: (contact: RecentContact) => void
  /** 칩 위 작은 제목 (기본 "최근 연락처") */
  label?: string
}

function digitsOf(phone: string): string {
  return phone.replace(/\D/g, "")
}

function chipLabel(contact: RecentContact): string {
  return [contact.name, contact.phone ? formatPhoneNumber(contact.phone) : ""]
    .filter(Boolean)
    .join(" · ")
}

/**
 * 연락처 입력 아래의 "최근 연락처/담당자" 칩. 같은 출처(매출) 또는 같은 거래처(배차)로 등록한
 * 이전 건의 연락처를 보여 주고, 누르면 입력칸을 채운다. 같은 거래처라도 담당자가 건마다
 * 달라서 자동으로 채우지는 않는다. 후보가 없으면 아무것도 그리지 않는다.
 *
 * 매출은 이름 없이 번호만(name = ""), 배차는 이름과 번호를 함께 쓴다.
 */
export function RecentContactChips({
  contacts,
  value,
  onSelect,
  label = "최근 연락처",
}: RecentContactChipsProps) {
  const labelId = useId()

  if (contacts.length === 0) return null

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={labelId} className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        // RecentRouteChips와 같은 가로 스크롤 줄 (contain:inline-size는 칩 너비가 화면 전체를 넓히지 않게 한다).
        className="no-scrollbar -mx-4 -my-1 flex gap-2 overflow-x-auto px-4 py-1 [contain:inline-size] md:mx-0 md:my-0 md:flex-wrap md:overflow-visible md:px-0 md:py-0 md:[contain:none]"
      >
        {contacts.map((contact) => {
          const isActive = isSameContact(contact, value)

          return (
            <button
              key={JSON.stringify([contact.name, digitsOf(contact.phone)])}
              type="button"
              aria-pressed={isActive}
              className={cn(chipVariants({ selected: isActive }), "tabular-nums")}
              onClick={() =>
                onSelect({
                  name: contact.name,
                  phone: contact.phone ? formatPhoneNumber(contact.phone) : "",
                })
              }
            >
              {chipLabel(contact)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
