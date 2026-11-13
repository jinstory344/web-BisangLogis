"use client"

import Link from "next/link"

import {
  ENTRY_TYPES,
  LAST_ENTRY_TYPE_KEY,
  newEntryHref,
  type EntryType,
} from "@/lib/entry-type"
import { cn } from "@/lib/utils"

/**
 * 통합 등록 화면 위쪽의 `매출 | 지출 | 배차` 전환 (가계부 앱의 수입|지출|이체처럼).
 * 고른 종류는 기억해 두었다가 ＋ 버튼을 다시 누르면 그 종류로 바로 연다.
 */
export function EntryTypeToggle({ value }: { value: EntryType }) {
  return (
    <nav aria-label="등록 종류" className="grid grid-cols-3 gap-2">
      {ENTRY_TYPES.map((type) => {
        const isActive = type.value === value
        return (
          <Link
            key={type.value}
            href={newEntryHref(type.value)}
            replace
            // 세 종류 화면을 미리 받아 두어 바꿀 때 바로 뜨게 한다.
            prefetch
            aria-current={isActive ? "page" : undefined}
            onClick={() => {
              try {
                localStorage.setItem(LAST_ENTRY_TYPE_KEY, type.value)
              } catch {
                // 저장소를 못 써도 전환은 그대로 된다.
              }
            }}
            className={cn(
              "flex h-11 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
              isActive
                ? "border-red-400 text-red-400"
                : "border-border bg-card text-muted-foreground"
            )}
          >
            {type.label}
          </Link>
        )
      })}
    </nav>
  )
}
