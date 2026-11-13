"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MAX_CATEGORY_NAME_LENGTH } from "@/lib/constants/expense-categories"

interface CategoryRenamerProps {
  /** 지금 이름 (입력칸에 미리 채워 둔다) */
  current: string
  /** 입력칸 위 안내 (예: "'유류' 이름 바꾸기") */
  label: string
  /** 성공하면 null, 실패하면 화면에 보여 줄 오류 문장 */
  onSave: (name: string) => Promise<string | null>
  onCancel: () => void
  /** 입력칸 아래 안내 (기본: 지출 분류 안내) */
  note?: string
}

/**
 * 분류 선택판 편집 모드에서 이름을 누르면 열리는 이름 바꾸기 칸.
 * 입력칸에서 Enter를 눌러도 지출 폼이 제출되지 않고 이름만 저장된다.
 */
export function CategoryRenamer({
  current,
  label,
  onSave,
  onCancel,
  note = "이미 등록한 지출의 분류 이름도 함께 바뀌어요.",
}: CategoryRenamerProps) {
  const [name, setName] = useState(current)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function save() {
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const message = await onSave(name)
      if (message) setError(message)
    } catch {
      setError("이름을 바꾸지 못했어요. 잠시 뒤 다시 시도하세요")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={name}
          maxLength={MAX_CATEGORY_NAME_LENGTH + 10}
          aria-label={label}
          disabled={isSaving}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              void save()
            }
          }}
          className="h-11 min-w-0 flex-1"
        />
        <Button
          type="button"
          className="h-11 shrink-0"
          disabled={isSaving || name.trim() === ""}
          onClick={() => void save()}
        >
          {isSaving ? "저장 중" : "저장"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 shrink-0"
          disabled={isSaving}
          onClick={onCancel}
        >
          취소
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
