"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  listClientsAction,
  quickCreateClientAction,
  type ClientSearchResult,
} from "@/app/(app)/clients/actions"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { formatBizNo } from "@/lib/biz-no"
import type { ClientCategory } from "@/lib/supabase/database.types"

interface ClientComboboxProps {
  value: ClientSearchResult | null
  onChange: (client: ClientSearchResult | null) => void
  disabled?: boolean
  /** "신규 등록"으로 새로 만들 거래처의 구분. 없으면 기본(내 거래처). */
  newClientCategory?: ClientCategory
}

const CREATE_ID = "__create__"

/** 띄어쓰기·대소문자·사업자번호의 "-"를 무시하고 비교 */
const normalize = (text: string) => text.replace(/[\s-]/g, "").toLowerCase()

/**
 * 2.2 거래처 고르기: 누르면 거래처 페이지의 전체 명단이 바로 뜨고, 글자를 치면 그 안에서 걸러진다.
 * 명단에 없는 이름을 치면 목록 맨 아래 "'X' 직접 입력"이 나타나고,
 * 고르는 즉시(별도 확인 창 없이) 거래처로 등록되면서 선택된다.
 */
export function ClientCombobox({
  value,
  onChange,
  disabled,
  newClientCategory,
}: ClientComboboxProps) {
  const [inputValue, setInputValue] = useState(value?.name ?? "")
  const [allClients, setAllClients] = useState<ClientSearchResult[]>([])
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    listClientsAction()
      .then(setAllClients)
      .catch(() => setAllClients([]))
  }, [])

  const trimmed = inputValue.trim()
  // 고른 거래처 이름이 그대로 칸에 있으면 걸러 내지 않고 전체를 보여 준다(다른 거래처로 바꾸기 쉽게).
  const query = trimmed === (value?.name ?? "") ? "" : normalize(trimmed)
  const items = query
    ? allClients.filter(
        (c) => normalize(c.name).includes(query) || (c.biz_no ?? "").includes(query)
      )
    : allClients
  const hasExactMatch = allClients.some((item) => item.name === trimmed)
  const showCreateOption = query !== "" && !hasExactMatch
  const displayItems: ClientSearchResult[] = showCreateOption
    ? [...items, { id: CREATE_ID, name: trimmed, biz_no: null }]
    : items

  async function handleValueChange(next: ClientSearchResult | null) {
    if (!next) {
      onChange(null)
      setInputValue("")
      return
    }

    if (next.id === CREATE_ID) {
      setIsCreating(true)
      try {
        const created = await quickCreateClientAction(
          next.name,
          newClientCategory
        )
        setAllClients((prev) =>
          prev.some((c) => c.id === created.id) ? prev : [...prev, created]
        )
        onChange(created)
        setInputValue(created.name)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "거래처 등록 실패")
      } finally {
        setIsCreating(false)
      }
      return
    }

    onChange(next)
    setInputValue(next.name)
  }

  return (
    <Combobox<ClientSearchResult>
      items={displayItems}
      value={value}
      onValueChange={handleValueChange}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      itemToStringLabel={(item) => item?.name ?? ""}
      filter={null}
      disabled={disabled || isCreating}
    >
      <ComboboxInput placeholder="눌러서 고르거나 직접 입력" />
      <ComboboxContent>
        <ComboboxList>
          {displayItems.map((item) =>
            item.id === CREATE_ID ? (
              <ComboboxItem key={item.id} value={item}>
                &quot;{item.name}&quot; 직접 입력 (거래처에 추가)
              </ComboboxItem>
            ) : (
              <ComboboxItem key={item.id} value={item}>
                {item.name}
                {item.biz_no ? ` (${formatBizNo(item.biz_no)})` : ""}
              </ComboboxItem>
            )
          )}
        </ComboboxList>
        <ComboboxEmpty>
          <p className="py-4 text-center text-sm text-muted-foreground">
            등록된 거래처가 없어요. 이름을 입력하세요
          </p>
        </ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  )
}
