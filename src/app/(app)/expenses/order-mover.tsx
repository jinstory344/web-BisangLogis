"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

/**
 * 분류·출처 편집에서 고른 칸의 순서를 한 칸씩 앞·뒤로 옮기는 줄.
 * 옮긴 뒤에도 같은 칸이 골라진 채라 여러 번 눌러 원하는 자리까지 옮길 수 있다.
 */
export function OrderMover({
  name,
  canMoveBack,
  canMoveForward,
  onMove,
}: {
  name: string
  canMoveBack: boolean
  canMoveForward: boolean
  /** 성공하면 null, 실패하면 오류 문장 */
  onMove: (direction: -1 | 1) => Promise<string | null>
}) {
  const [isMoving, setIsMoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function move(direction: -1 | 1) {
    if (isMoving) return
    setIsMoving(true)
    setError(null)
    try {
      setError(await onMove(direction))
    } catch {
      setError("순서를 바꾸지 못했어요. 잠시 뒤 다시 시도하세요")
    } finally {
      setIsMoving(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">&apos;{name}&apos; 순서</p>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 gap-1"
          disabled={isMoving || !canMoveBack}
          onClick={() => void move(-1)}
        >
          <ChevronLeft className="size-4" />
          앞으로
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 gap-1"
          disabled={isMoving || !canMoveForward}
          onClick={() => void move(1)}
        >
          뒤로
          <ChevronRight className="size-4" />
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

/** 같은 단계 이름들 안에서 이 이름을 앞·뒤로 옮길 수 있는지 */
export function moveBounds(
  siblings: readonly string[],
  name: string
): { canMoveBack: boolean; canMoveForward: boolean } {
  const index = siblings.indexOf(name)
  return { canMoveBack: index > 0, canMoveForward: index >= 0 && index < siblings.length - 1 }
}
