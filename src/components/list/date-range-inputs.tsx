"use client"

import { useState } from "react"

import { Input } from "@/components/ui/input"

interface DateRangeInputsProps {
  from: string
  to: string
  onApply: (range: { from: string; to: string }) => void
}

/**
 * 기간 직접 지정: 입력을 마치고 포커스가 벗어나면 적용한다 (데스크톱 필터와 같은 방식).
 * 달을 넘겨 기간이 바뀌면 입력값도 새 기간으로 바뀌도록, 쓰는 쪽에서 `key`를 기간으로 준다.
 */
export function DateRangeInputs({ from, to, onApply }: DateRangeInputsProps) {
  const [dateFrom, setDateFrom] = useState(from)
  const [dateTo, setDateTo] = useState(to)

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        aria-label="시작일"
        value={dateFrom}
        onChange={(e) => setDateFrom(e.target.value)}
        onBlur={() => onApply({ from: dateFrom, to: dateTo })}
        className="h-11 min-w-0 flex-1"
      />
      <span className="text-muted-foreground">~</span>
      <Input
        type="date"
        aria-label="종료일"
        value={dateTo}
        onChange={(e) => setDateTo(e.target.value)}
        onBlur={() => onApply({ from: dateFrom, to: dateTo })}
        className="h-11 min-w-0 flex-1"
      />
    </div>
  )
}
