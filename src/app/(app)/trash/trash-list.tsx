"use client"

import { ChevronLeft, RotateCcw, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { ConfirmDelete } from "@/components/common/confirm-delete"
import { PageTitle } from "@/components/layout/page-title"
import { StickyHead } from "@/components/layout/sticky-head"
import { TRASH_KIND_LABEL, TRASH_KIND_TAG, TRASH_KEEP_DAYS, trashDaysLeft, type TrashItem, type TrashKind } from "@/lib/trash"
import { cn } from "@/lib/utils"

import { purgeTrashAction, restoreTrashAction } from "./actions"

const TABS: ("all" | TrashKind)[] = ["all", "sale", "expense", "dispatch", "client", "vehicle", "memo", "car_log"]
/** 밀었을 때 드러나는 버튼 두 개의 폭 */
const ACTIONS_W = 128
const keyOf = (item: Pick<TrashItem, "kind" | "id">) => `${item.kind}:${item.id}`

/**
 * 휴지통 (사용자 고른 시안): 줄을 왼쪽으로 밀면 ↺ 복구 · 🗑 완전 삭제,
 * 오른쪽 위 [모두 선택] → 전부 체크(줄을 누르면 빠짐) → 아래 [N건 복구][N건 삭제].
 */
export function TrashList({ items }: { items: TrashItem[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<"all" | TrashKind>("all")
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [purgeTargets, setPurgeTargets] = useState<TrashItem[] | null>(null)
  const [isPending, startTransition] = useTransition()

  const visible = tab === "all" ? items : items.filter((i) => i.kind === tab)
  const counts = Object.fromEntries(TABS.map((t) => [t, t === "all" ? items.length : items.filter((i) => i.kind === t).length]))
  const isSelecting = selected !== null
  const chosen = isSelecting ? visible.filter((i) => selected.has(keyOf(i))) : []

  function run(kind: "restore" | "purge", targets: TrashItem[]) {
    if (targets.length === 0) return
    startTransition(async () => {
      const payload = targets.map(({ kind: k, id }) => ({ kind: k, id }))
      const { done, error } = kind === "restore" ? await restoreTrashAction(payload) : await purgeTrashAction(payload)
      if (done > 0) toast.success(kind === "restore" ? `${done}건 복구했어요` : `${done}건 완전히 지웠어요`)
      if (error) toast.error(error)
      setOpenKey(null)
      setSelected(null)
      router.refresh()
    })
  }

  function toggle(item: TrashItem) {
    setSelected((prev) => {
      const next = new Set(prev)
      const k = keyOf(item)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  return (
    <>
      <StickyHead className="-mx-4 -mt-4 px-4 pt-4 pb-1 md:static md:mx-0 md:mt-0 md:px-0 md:pt-0">
        <div className="mt-2 grid h-10 grid-cols-[4.5rem_1fr_4.5rem] items-center md:mt-0">
          <button
            type="button"
            aria-label="뒤로"
            onClick={() => router.back()}
            className="-ml-2 flex size-10 items-center justify-center text-muted-foreground"
          >
            <ChevronLeft className="size-6" />
          </button>
          <PageTitle title="휴지통" barClassName="bg-foreground/60" />
          <button
            type="button"
            disabled={visible.length === 0}
            onClick={() => {
              setOpenKey(null)
              setSelected(isSelecting ? null : new Set(visible.map(keyOf)))
            }}
            className="justify-self-end text-[15px] font-semibold text-[#0a84ff] disabled:opacity-30"
          >
            {isSelecting ? "취소" : "모두 선택"}
          </button>
        </div>
        <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => {
                setTab(t)
                setOpenKey(null)
                if (isSelecting) setSelected(new Set((t === "all" ? items : items.filter((i) => i.kind === t)).map(keyOf)))
              }}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px]",
                tab === t ? "bg-foreground font-semibold text-background" : "bg-muted text-muted-foreground"
              )}
            >
              {t === "all" ? "전체" : TRASH_KIND_LABEL[t]}
              <span className="text-[11px] tabular-nums opacity-70">{counts[t]}</span>
            </button>
          ))}
        </div>
      </StickyHead>

      <p className="pt-1 pb-2 text-xs text-muted-foreground">
        {isSelecting
          ? "줄을 누르면 선택에서 빠져요"
          : `줄을 왼쪽으로 밀면 복구·삭제가 나와요 · ${TRASH_KEEP_DAYS}일 지나면 저절로 비워져요`}
      </p>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">휴지통이 비어 있어요</p>
      ) : (
        <ul className={cn("-mx-4 border-t md:mx-0", isSelecting && "pb-20")}>
          {visible.map((item) => (
            <TrashRow
              key={keyOf(item)}
              item={item}
              isOpen={openKey === keyOf(item)}
              onOpenChange={(open) => setOpenKey(open ? keyOf(item) : null)}
              isSelecting={isSelecting}
              isChecked={isSelecting && selected.has(keyOf(item))}
              onToggle={() => toggle(item)}
              disabled={isPending}
              onRestore={() => run("restore", [item])}
              onPurge={() => setPurgeTargets([item])}
            />
          ))}
        </ul>
      )}

      {isSelecting ? (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 grid grid-cols-2 gap-2 border-t bg-background/95 px-4 py-2.5 backdrop-blur md:bottom-0">
          <button
            type="button"
            disabled={chosen.length === 0 || isPending}
            onClick={() => run("restore", chosen)}
            className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-[#0a84ff] text-[15px] font-semibold text-white disabled:opacity-40"
          >
            <RotateCcw className="size-[18px]" />
            {chosen.length}건 복구
          </button>
          <button
            type="button"
            disabled={chosen.length === 0 || isPending}
            onClick={() => setPurgeTargets(chosen)}
            className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-muted text-[15px] font-semibold text-[#ff453a] disabled:opacity-40"
          >
            <Trash2 className="size-[18px]" />
            {chosen.length}건 삭제
          </button>
        </div>
      ) : null}

      <ConfirmDelete
        open={purgeTargets !== null}
        onOpenChange={(open) => !open && setPurgeTargets(null)}
        title={
          purgeTargets?.length === 1
            ? `'${purgeTargets[0].title}'을(를) 완전히 삭제할까요?`
            : `${purgeTargets?.length ?? 0}건을 완전히 삭제할까요?`
        }
        description="완전히 지우면 되살릴 수 없어요"
        onConfirm={() => {
          if (purgeTargets) run("purge", purgeTargets)
          setPurgeTargets(null)
        }}
      />
    </>
  )
}

function TrashRow({
  item,
  isOpen,
  onOpenChange,
  isSelecting,
  isChecked,
  onToggle,
  disabled,
  onRestore,
  onPurge,
}: {
  item: TrashItem
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  isSelecting: boolean
  isChecked: boolean
  onToggle: () => void
  disabled: boolean
  onRestore: () => void
  onPurge: () => void
}) {
  // 손가락을 따라 움직이는 동안의 위치(px). 놓으면 열림(-ACTIONS_W)·닫힘(0) 중 가까운 쪽으로
  const [drag, setDrag] = useState<number | null>(null)
  const start = useRef<{ x: number; y: number; base: number; horizontal: boolean | null } | null>(null)
  const offset = drag ?? (isOpen && !isSelecting ? -ACTIONS_W : 0)
  const daysLeft = trashDaysLeft(item.deletedAt)

  return (
    <li className={cn("relative overflow-hidden border-b", isChecked && "bg-[#0a84ff]/10")}>
      {/* 밀면 드러나는 버튼 (아이콘만): ↺ 복구 · 🗑 완전 삭제 */}
      {!isSelecting ? (
        <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTIONS_W }}>
          <button
            type="button"
            aria-label={`${item.title} 복구`}
            disabled={disabled}
            onClick={onRestore}
            className="flex flex-1 items-center justify-center bg-[#0a84ff] text-white"
          >
            <RotateCcw className="size-[22px]" />
          </button>
          <button
            type="button"
            aria-label={`${item.title} 완전 삭제`}
            disabled={disabled || item.kept}
            onClick={onPurge}
            className="flex flex-1 items-center justify-center bg-[#ff453a] text-white disabled:bg-muted disabled:text-muted-foreground"
          >
            <Trash2 className="size-[22px]" />
          </button>
        </div>
      ) : null}

      <div
        className={cn(
          "relative flex min-h-15 items-center gap-2.5 bg-background px-4 py-2.5 md:pr-[8.5rem]",
          drag === null && "transition-transform duration-200",
          isChecked && "bg-transparent"
        )}
        style={{ transform: `translateX(${offset}px)` }}
        onClick={() => {
          if (isSelecting) onToggle()
          else if (isOpen) onOpenChange(false)
        }}
        onTouchStart={(e) => {
          if (isSelecting) return
          start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: offset, horizontal: null }
        }}
        onTouchMove={(e) => {
          const s = start.current
          if (!s) return
          const dx = e.touches[0].clientX - s.x
          const dy = e.touches[0].clientY - s.y
          if (s.horizontal === null && Math.abs(dx) + Math.abs(dy) > 6) s.horizontal = Math.abs(dx) > Math.abs(dy)
          if (!s.horizontal) return
          setDrag(Math.min(0, Math.max(-ACTIONS_W - 24, s.base + dx)))
        }}
        onTouchEnd={() => {
          const s = start.current
          start.current = null
          if (!s?.horizontal || drag === null) {
            setDrag(null)
            return
          }
          onOpenChange(drag < -ACTIONS_W / 2)
          setDrag(null)
        }}
      >
        {isSelecting ? (
          <span
            aria-hidden
            className={cn(
              "flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-xs",
              isChecked ? "border-[#0a84ff] bg-[#0a84ff] text-white" : "border-muted-foreground/60"
            )}
          >
            {isChecked ? "✓" : null}
          </span>
        ) : null}
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {/* 종류 꼬리표: 왼쪽 위, 폭을 같게 맞춰 제목이 가지런하게 */}
          <span
            className={cn(
              "mt-0.5 w-11 shrink-0 rounded-[5px] py-0.5 text-center text-[11px] font-bold",
              TRASH_KIND_TAG[item.kind]
            )}
          >
            {TRASH_KIND_LABEL[item.kind]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{item.title}</span>
            {item.sub ? <span className="block truncate text-[13px] text-muted-foreground">{item.sub}</span> : null}
          </span>
        </div>
        {!isSelecting ? (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {item.kept ? "기록 있어 보관" : `${daysLeft}일 남음`}
          </span>
        ) : null}
      </div>

      {/* 컴퓨터 화면: 밀 수 없으니 버튼을 늘 보이게 */}
      {!isSelecting ? (
        <div className="absolute inset-y-0 right-3 hidden items-center gap-1 md:flex">
          <button
            type="button"
            aria-label={`${item.title} 복구`}
            disabled={disabled}
            onClick={onRestore}
            className="flex size-9 items-center justify-center rounded-full text-[#0a84ff] hover:bg-muted"
          >
            <RotateCcw className="size-[18px]" />
          </button>
          <button
            type="button"
            aria-label={`${item.title} 완전 삭제`}
            disabled={disabled || item.kept}
            onClick={onPurge}
            className="flex size-9 items-center justify-center rounded-full text-[#ff453a] hover:bg-muted disabled:opacity-30"
          >
            <Trash2 className="size-[18px]" />
          </button>
        </div>
      ) : null}
    </li>
  )
}
