"use client"

import { Plus } from "lucide-react"
import { useState } from "react"

import { chipVariants } from "@/components/form/choice-chips"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MAX_CATEGORY_NAME_LENGTH } from "@/lib/constants/expense-categories"
import { cn } from "@/lib/utils"

interface CategoryAdderProps {
  /** 닫혀 있을 때 칩에 쓰는 글자 (예: "분류 추가") */
  label: string
  placeholder: string
  /** 추가에 성공하면 null, 실패하면 화면에 보여 줄 오류 문장을 돌려준다. */
  onAdd: (name: string) => Promise<string | null>
}

/**
 * 대분류·소분류 칩 아래의 "＋ 추가" 칩. 누르면 이름 입력칸이 열리고, 저장하면 분류 목록에 바로 추가된다.
 * 입력칸에서 Enter를 눌러도 지출 폼이 제출되지 않고 이 분류만 저장된다.
 */
export function CategoryAdder({ label, placeholder, onAdd }: CategoryAdderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function close() {
    setIsOpen(false)
    setName("")
    setError(null)
  }

  async function save() {
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const message = await onAdd(name)
      if (message) setError(message)
      else close()
    } catch {
      setError("분류를 저장하지 못했어요. 잠시 뒤 다시 시도하세요")
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(chipVariants({ selected: false }), "w-fit border-dashed")}
      >
        <Plus />
        {label}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={name}
          maxLength={MAX_CATEGORY_NAME_LENGTH + 10}
          placeholder={placeholder}
          aria-label={label}
          disabled={isSaving}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // 지출 폼이 제출되지 않도록 막고 분류만 저장한다.
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
          onClick={close}
        >
          취소
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
