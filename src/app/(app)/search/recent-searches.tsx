"use client"

import { ChevronRight, History } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

const STORAGE_KEY = "bisang:recent-searches"
const MAX_RECENT = 5

export interface RecentSearch {
  href: string
  /** "우영로지스 · 올해" */
  label: string
  /** "매출" · "전체" 등 탭 이름 */
  kind: string
}

function load(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const list = raw ? (JSON.parse(raw) as RecentSearch[]) : []
    return Array.isArray(list) ? list.filter((r) => r && typeof r.href === "string").slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

function save(list: RecentSearch[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_RECENT)))
  } catch {
    // 저장이 막힌 브라우저(개인 정보 보호 모드 등)에서는 최근 조건만 안 남는다
  }
}

/** 검색 결과를 볼 때 그 조건을 "최근에 찾은 조건"에 남긴다 (이 폰에만, 최근 5개). */
export function RememberSearch({ search }: { search: RecentSearch }) {
  useEffect(() => {
    const rest = load().filter((r) => r.href !== search.href)
    save([search, ...rest])
  }, [search])
  return null
}

/** 검색 첫 화면의 "최근에 찾은 조건" 카드들 */
export function RecentSearches() {
  const [list, setList] = useState<RecentSearch[]>([])
  // 저장된 목록은 브라우저에서만 읽을 수 있어서, 화면이 뜬 뒤에 한 번 읽는다
  useEffect(() => setList(load()), [])

  if (list.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>최근에 찾은 조건</span>
        <button
          type="button"
          className="px-1 py-1 text-sm"
          onClick={() => {
            save([])
            setList([])
          }}
        >
          지우기
        </button>
      </div>
      {list.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-3 rounded-xl bg-card px-3.5 py-3 active:bg-muted"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <History className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">{item.label}</span>
            <span className="block text-xs text-muted-foreground">{item.kind}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </section>
  )
}
