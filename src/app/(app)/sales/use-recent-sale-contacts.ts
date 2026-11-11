"use client"

import { useEffect, useState } from "react"

import { getRecentSaleContactsAction } from "./actions"

/**
 * 같은 출처(대분류+소분류)의 이전 매출에서 쓴 최근 연락처를 불러온다 (매출 폼 "최근 연락처" 칩).
 * 소분류가 비어 있으면 조회하지 않고 빈 목록을 돌려준다.
 *
 * 소분류를 입력하는 동안 매 글자마다 조회하지 않도록 잠시 기다린 뒤 한 번만 조회하고,
 * 그사이 출처가 바뀌어 늦게 도착한 응답은 버린다 (결과에 어느 출처의 것인지 key를 함께 저장해
 * 현재 출처와 맞을 때만 보여 준다). 조회에 실패하면 칩만 안 보일 뿐 폼은 그대로 쓸 수 있다.
 */
export function useRecentSaleContacts(
  sourceMajor: string,
  sourceMinor: string
): string[] {
  const major = sourceMajor.trim()
  const minor = sourceMinor.trim()
  const key = JSON.stringify([major, minor])
  const [result, setResult] = useState<{ key: string; contacts: string[] }>({
    key: "",
    contacts: [],
  })

  useEffect(() => {
    if (!minor) return

    let cancelled = false
    const timeout = setTimeout(() => {
      getRecentSaleContactsAction({ sourceMajor: major, sourceMinor: minor })
        .then((contacts) => {
          if (!cancelled) setResult({ key, contacts })
        })
        .catch(() => {
          if (!cancelled) setResult({ key, contacts: [] })
        })
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [key, major, minor])

  return minor && result.key === key ? result.contacts : []
}
