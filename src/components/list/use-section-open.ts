"use client"

import { useState } from "react"

/**
 * 목록 묶음(차량·거래처의 "전체")을 접고 펴는 상태.
 * 사용자 요청: 화면을 열 때마다 접힌 채로 시작한다(펴 둔 것을 기억하지 않음).
 */
export function useSectionOpen(): [boolean, () => void] {
  const [open, setOpen] = useState(false)
  return [open, () => setOpen((prev) => !prev)]
}
