"use client"

import { useLinkStatus } from "next/link"

/** 탭을 누른 뒤 결과를 받는 동안 탭 위에 옅게 깜빡이는 막을 씌워 "눌렸다"를 바로 보여 준다 */
export function TabPending() {
  const { pending } = useLinkStatus()
  return pending ? (
    <span aria-hidden className="pointer-events-none absolute inset-0 animate-pulse rounded-full bg-white/25" />
  ) : null
}
