"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  searchClientsAction,
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

interface ClientComboboxProps {
  value: ClientSearchResult | null
  onChange: (client: ClientSearchResult | null) => void
  disabled?: boolean
}

const MIN_QUERY_LENGTH = 2
const CREATE_ID = "__create__"

/**
 * 2.2 거래처 자동완성: 사업자명 2글자 이상 입력 시 검색.
 * 일치하는 거래처가 없으면 목록 안에 "'X' 신규 등록" 항목이 나타나고,
 * 선택하는 즉시(별도 확인 창 없이) 등록과 선택이 함께 이루어진다.
 */
export function ClientCombobox({
  value,
  onChange,
  disabled,
}: ClientComboboxProps) {
  const [inputValue, setInputValue] = useState(value?.name ?? "")
  const [items, setItems] = useState<ClientSearchResult[]>([])
  const [, startTransition] = useTransition()
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    const query = inputValue.trim()
    if (query.length < MIN_QUERY_LENGTH) {
      setItems([])
      return
    }

    const timeout = setTimeout(() => {
      startTransition(async () => {
        try {
          const results = await searchClientsAction(query)
          setItems(results)
        } catch {
          setItems([])
        }
      })
    }, 250)

    return () => clearTimeout(timeout)
  }, [inputValue])

  const trimmed = inputValue.trim()
  const hasExactMatch = items.some((item) => item.name === trimmed)
  const showCreateOption = trimmed.length >= MIN_QUERY_LENGTH && !hasExactMatch
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
        const created = await quickCreateClientAction(next.name)
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
      <ComboboxInput placeholder="거래처명 2글자 이상 입력" />
      <ComboboxContent>
        <ComboboxList>
          {displayItems.map((item) =>
            item.id === CREATE_ID ? (
              <ComboboxItem key={item.id} value={item}>
                &quot;{item.name}&quot; 신규 등록
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
            사업자명을 2글자 이상 입력하세요
          </p>
        </ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  )
}
