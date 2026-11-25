"use client"

import { Check, X } from "lucide-react"

import { AmountInput } from "@/components/form/amount-input"
import { chipVariants } from "@/components/form/choice-chips"
import { cn } from "@/lib/utils"

export interface ServiceLineValue {
  item: string
  amount: number | null
}

/** 항목 줄 금액 합 (빈칸은 빼고). 하나도 없으면 0 */
export function serviceLinesTotal(lines: readonly ServiceLineValue[]): number {
  return lines.reduce((sum, line) => sum + (line.amount ?? 0), 0)
}

/**
 * 정비 항목 칸: 항목 칩(누르면 줄 추가/빼기) + 줄마다 금액(선택).
 * 지출 등록(차량 › 정비)과 차계부 기록(정비)이 함께 쓴다.
 * 목록에서 지운 항목이 붙은 예전 기록도 칩으로 보여 빼거나 남길 수 있다.
 */
export function ServiceItemsField({
  names,
  value,
  onChange,
}: {
  /** 정비 항목 목록 (설정 › 차계부에서 추가·삭제) */
  names: readonly string[]
  value: readonly ServiceLineValue[]
  onChange: (value: ServiceLineValue[]) => void
}) {
  const chosen = new Set(value.map((line) => line.item))
  // 목록에 없는 항목(지운 항목의 옛 기록)도 칩으로
  const chips = [...names, ...value.map((line) => line.item).filter((item) => !names.includes(item))]

  function toggle(item: string) {
    if (chosen.has(item)) onChange(value.filter((line) => line.item !== item))
    else onChange([...value, { item, amount: null }])
  }

  function setAmount(index: number, amount: number | null) {
    onChange(value.map((line, i) => (i === index ? { ...line, amount } : line)))
  }

  return (
    <div className="flex flex-col gap-3">
      {chips.length > 0 ? (
        <div role="group" aria-label="정비 항목 고르기" className="flex flex-wrap gap-2">
          {chips.map((item) => {
            const isOn = chosen.has(item)
            return (
              <button
                key={item}
                type="button"
                aria-pressed={isOn}
                onClick={() => toggle(item)}
                className={cn(chipVariants({ selected: isOn }), "min-h-9 px-3 text-[13px] md:min-h-8")}
              >
                {isOn ? <Check className="size-3.5" /> : null}
                {item}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">정비 항목 목록이 비어 있어요. 차계부 › ⚙에서 추가하세요.</p>
      )}

      {value.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-lg border">
          {value.map((line, index) => (
            <li key={line.item} className="flex items-center gap-2 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{line.item}</span>
              <AmountInput
                nullable
                value={line.amount}
                onChange={(amount) => setAmount(index, amount)}
                placeholder="금액(선택)"
                aria-label={`${line.item} 금액`}
                className="h-10 w-36 shrink-0"
              />
              <button
                type="button"
                aria-label={`${line.item} 빼기`}
                onClick={() => toggle(line.item)}
                className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
