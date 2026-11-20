"use client"

import { ChevronLeft, FileSpreadsheet } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { PageTitle } from "@/components/layout/page-title"
import { getCurrentMonthRangeInSeoul, getPreviousMonthRangeInSeoul, getTodayInSeoul } from "@/lib/date"
import { DATED_KINDS, EXPORT_KINDS, exportFileName, type ExportKind } from "@/lib/excel-export"
import { TRASH_KIND_TAG } from "@/lib/trash"
import { cn } from "@/lib/utils"

import { exportCountsAction } from "./actions"

type PeriodKey = "month" | "prevMonth" | "year" | "prevYear" | "all" | "custom"
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "month", label: "이번 달" },
  { key: "prevMonth", label: "지난달" },
  { key: "year", label: "올해" },
  { key: "prevYear", label: "작년" },
  { key: "all", label: "전체" },
  { key: "custom", label: "날짜 선택" },
]

function rangeOf(key: PeriodKey, custom: { from: string; to: string }): { from: string; to: string } | null {
  const year = Number(getTodayInSeoul().slice(0, 4))
  switch (key) {
    case "month":
      return getCurrentMonthRangeInSeoul()
    case "prevMonth":
      return getPreviousMonthRangeInSeoul()
    case "year":
      return { from: `${year}-01-01`, to: `${year}-12-31` }
    case "prevYear":
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` }
    case "all":
      return null
    case "custom":
      return custom.from && custom.to && custom.from <= custom.to ? custom : null
  }
}

/**
 * 엑셀 내보내기 (사용자 고른 흐름): 무엇을(매출·지출·배차·거래처·차량) · 기간 → [엑셀 파일 만들기]
 * → 아이폰 공유창(카톡·메일·파일에 저장). 공유창이 없으면(컴퓨터) 그냥 내려받는다.
 */
export function ExportForm({ initialCounts }: { initialCounts: Record<ExportKind, number> }) {
  const router = useRouter()
  const [kinds, setKinds] = useState<Set<ExportKind>>(new Set(EXPORT_KINDS.map((k) => k.value)))
  const [periodKey, setPeriodKey] = useState<PeriodKey>("month")
  const today = getTodayInSeoul()
  const [custom, setCustom] = useState({ from: `${today.slice(0, 8)}01`, to: today })
  const [counts, setCounts] = useState(initialCounts)
  const [isCounting, startCounting] = useTransition()
  const [isMaking, setIsMaking] = useState(false)
  // 파일은 만들었는데 아이폰이 공유창을 막았을 때(누른 뒤 시간이 지나서): [공유하기]를 한 번 더 누르게
  const [readyFile, setReadyFile] = useState<File | null>(null)

  async function share(file: File) {
    try {
      await navigator.share({ files: [file], title: file.name })
      setReadyFile(null)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setReadyFile(file)
        return
      }
      throw err
    }
  }

  const period = rangeOf(periodKey, custom)
  const fileName = exportFileName(period?.from ?? null, period?.to ?? null)
  const chosen = EXPORT_KINDS.filter((k) => kinds.has(k.value))

  function changePeriod(key: PeriodKey, nextCustom = custom) {
    setPeriodKey(key)
    const next = rangeOf(key, nextCustom)
    if (key === "custom" && !next) return
    startCounting(async () => setCounts(await exportCountsAction(next)))
  }

  async function make() {
    if (chosen.length === 0) return
    setIsMaking(true)
    try {
      const params = new URLSearchParams({ kinds: chosen.map((k) => k.value).join(",") })
      if (period) {
        params.set("from", period.from)
        params.set("to", period.to)
      }
      const res = await fetch(`/api/export?${params}`)
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const file = new File([blob], fileName, { type: blob.type })
      // 아이폰: 공유창(카톡·메일·파일에 저장). 안 되면 내려받기
      if (navigator.canShare?.({ files: [file] })) {
        await share(file)
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = fileName
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
        toast.success(`${fileName} 내려받았어요`)
      }
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "엑셀 파일을 만들지 못했어요")
    } finally {
      setIsMaking(false)
    }
  }

  return (
    <div className="flex flex-col gap-1 pb-24">
      <div className="mt-2 grid h-10 grid-cols-[2.5rem_1fr_2.5rem] items-center md:mt-0">
        <button
          type="button"
          aria-label="뒤로"
          onClick={() => router.back()}
          className="-ml-2 flex size-10 items-center justify-center text-muted-foreground"
        >
          <ChevronLeft className="size-6" />
        </button>
        <PageTitle title="엑셀 내보내기" barClassName="bg-foreground/60" />
        <span />
      </div>

      <p className="mt-6 px-1 text-[13px] text-muted-foreground">무엇을</p>
      <div className="overflow-hidden rounded-xl border">
        {EXPORT_KINDS.map((k) => {
          const on = kinds.has(k.value)
          return (
            <button
              key={k.value}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() =>
                setKinds((prev) => {
                  const next = new Set(prev)
                  if (next.has(k.value)) next.delete(k.value)
                  else next.add(k.value)
                  return next
                })
              }
              className="flex h-12 w-full items-center gap-3 border-b px-4 text-left last:border-b-0 active:bg-muted"
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-[22px] items-center justify-center rounded-md border-[1.5px] text-xs",
                  on ? "border-[#0a84ff] bg-[#0a84ff] text-white" : "border-muted-foreground/60"
                )}
              >
                {on ? "✓" : null}
              </span>
              <span className={cn("w-11 rounded-[5px] py-0.5 text-center text-[11px] font-bold", TRASH_KIND_TAG[k.value])}>
                {k.label}
              </span>
              <span className={cn("ml-auto text-sm tabular-nums text-muted-foreground", isCounting && "opacity-50")}>
                {counts[k.value].toLocaleString("ko-KR")}
                {k.unit}
                {DATED_KINDS.includes(k.value) ? "" : " (전체)"}
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-5 px-1 text-[13px] text-muted-foreground">기간 (매출·지출·배차)</p>
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={periodKey === p.key}
            onClick={() => changePeriod(p.key)}
            className={cn(
              "h-9 rounded-full px-3.5 text-sm",
              periodKey === p.key ? "bg-foreground font-semibold text-background" : "bg-muted text-muted-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {periodKey === "custom" ? (
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <input
            type="date"
            value={custom.from}
            max={custom.to}
            onChange={(e) => {
              const next = { ...custom, from: e.target.value }
              setCustom(next)
              changePeriod("custom", next)
            }}
            className="h-11 min-w-0 rounded-lg border bg-transparent px-3 text-base"
          />
          <span className="text-muted-foreground">~</span>
          <input
            type="date"
            value={custom.to}
            min={custom.from}
            onChange={(e) => {
              const next = { ...custom, to: e.target.value }
              setCustom(next)
              changePeriod("custom", next)
            }}
            className="h-11 min-w-0 rounded-lg border bg-transparent px-3 text-base"
          />
        </div>
      ) : null}

      <div className="mt-5 flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3">
        <FileSpreadsheet className="size-7 shrink-0 text-[#30a46c]" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{fileName}</span>
          <span className="block text-xs text-muted-foreground">
            {chosen.length > 0 ? `시트 ${chosen.length}개 · ${chosen.map((k) => k.label).join(" / ")}` : "종류를 골라 주세요"}
          </span>
        </span>
      </div>

      {readyFile ? (
        <button
          type="button"
          onClick={() => void share(readyFile).catch(() => toast.error("공유하지 못했어요"))}
          className="mt-4 flex h-12 items-center justify-center rounded-xl bg-[#30a46c] text-base font-semibold text-white"
        >
          파일이 준비됐어요 · 공유하기
        </button>
      ) : null}

      <button
        type="button"
        disabled={chosen.length === 0 || isMaking}
        onClick={() => {
          setReadyFile(null)
          void make()
        }}
        className="mt-4 flex h-12 items-center justify-center rounded-xl bg-[#0a84ff] text-base font-semibold text-white disabled:opacity-40"
      >
        {isMaking ? "만드는 중…" : "엑셀 파일 만들기"}
      </button>
    </div>
  )
}
