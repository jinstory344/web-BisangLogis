"use client"

import { useMemo, useState } from "react"

import {
  buildDayBuckets,
  filterLedgerEntries,
  type LedgerKindFilter,
} from "@/lib/ledger"

import type { DayLedgerEntry } from "@/app/(app)/ledger-data"

import { LedgerDayList } from "./ledger-day-list"
import { LedgerKindChips } from "./ledger-kind-chips"

/**
 * 일일 장부: 거르기 칩 + 날짜별 목록. 칩을 누르면 화면에서 바로 거르고(서버를 부르지 않음),
 * 주소의 kind만 바꿔 둔다(새로고침해도 같은 거르기로 열리게).
 */
export function LedgerDayView({
  anchor,
  entries,
  initialKind,
}: {
  anchor: string
  entries: DayLedgerEntry[]
  initialKind: LedgerKindFilter
}) {
  const [kind, setKind] = useState(initialKind)
  const filtered = useMemo(() => filterLedgerEntries(entries, kind), [entries, kind])
  const buckets = useMemo(() => buildDayBuckets(filtered), [filtered])

  function choose(next: LedgerKindFilter) {
    setKind(next)
    const url = `/?view=day&d=${anchor}${next === "all" ? "" : `&kind=${next}`}`
    window.history.replaceState(window.history.state, "", url)
  }

  return (
    <>
      <LedgerKindChips value={kind} onChange={choose} count={filtered.length} />
      {/* 날짜 줄은 위 고정 머리 + 거르기 칩 줄(52px + 아래 선 1px) 밑에 붙는다 */}
      <LedgerDayList buckets={buckets} dayStickyTopClassName="top-[calc(var(--sticky-head-h,0px)_+_52px)]" />
    </>
  )
}
