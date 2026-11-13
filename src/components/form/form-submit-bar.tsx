import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

/**
 * 입력 폼 저장 버튼. 모바일은 하단 탭 바로 위에 고정(버튼 높이 48px), md 이상은 폼 끝의
 * 일반 버튼(기존 크기). 고정 바(약 73px)에 마지막 칸이 가리지 않도록 폼에는
 * touchFormProps(하단 여백 포함)를 함께 쓴다.
 */
export function FormSubmitBar({
  disabled,
  children,
}: {
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <div className="fixed inset-x-0 bottom-14 z-30 border-t bg-background p-3 md:static md:bottom-auto md:z-auto md:border-0 md:p-0">
      <Button
        type="submit"
        className="h-12 w-full text-base md:h-8 md:w-auto md:text-sm"
        disabled={disabled}
      >
        {children}
      </Button>
    </div>
  )
}

/**
 * 매출·배차·지출 등록/수정 폼(<form>)에 붙이는 공통 속성.
 * - data-touch-form: globals.css에서 md 미만일 때만 이 폼 안의 입력칸·선택·콤보박스를
 *   44px로 키운다 (ui/* 기본 크기는 목록 필터·다이얼로그용으로 그대로 둔다).
 * - pb-28: 모바일 고정 저장 바에 마지막 칸이 가리지 않게 하는 하단 여백.
 */
export const touchFormProps = {
  "data-touch-form": "",
  className: "flex flex-col gap-4 pb-28 md:pb-0",
} as const
