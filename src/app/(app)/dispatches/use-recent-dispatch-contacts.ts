"use client"

import { useEffect, useState } from "react"

import type { RecentContact } from "@/lib/quick-entry"

import { getRecentDispatchContactsAction } from "./actions"

/**
 * 선택한 거래처로 이전에 등록한 배차의 담당자(이름+연락처)를 불러온다 (배차 폼 "최근 담당자" 칩).
 * 거래처가 비어 있으면 조회하지 않고 빈 목록을 돌려준다.
 *
 * 거래처를 바꾸는 사이 늦게 도착한 이전 거래처의 응답은 버린다 (결과에 어느 거래처의 것인지
 * clientId를 함께 저장해 현재 거래처와 맞을 때만 보여 준다). 조회에 실패하면 칩만 안 보일 뿐
 * 폼은 그대로 쓸 수 있다.
 */
export function useRecentDispatchContacts(clientId: string): RecentContact[] {
  const [result, setResult] = useState<{
    clientId: string
    contacts: RecentContact[]
  }>({ clientId: "", contacts: [] })

  useEffect(() => {
    if (!clientId) return

    let cancelled = false
    getRecentDispatchContactsAction(clientId)
      .then((contacts) => {
        if (!cancelled) setResult({ clientId, contacts })
      })
      .catch(() => {
        if (!cancelled) setResult({ clientId, contacts: [] })
      })

    return () => {
      cancelled = true
    }
  }, [clientId])

  return clientId && result.clientId === clientId ? result.contacts : []
}
