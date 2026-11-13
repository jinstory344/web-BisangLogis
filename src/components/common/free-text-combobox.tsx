"use client"

import { useEffect, useState, useTransition } from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

interface FreeTextComboboxProps {
  value: string
  onChange: (value: string) => void
  fetchSuggestions: (query: string) => Promise<string[]>
  placeholder?: string
  disabled?: boolean
}

/**
 * 항상 자유 입력을 허용하되, 최근 입력값을 제안하는 콤보박스.
 * 7.3 상차지/하차지 "최근 입력값 자동완성"용.
 */
export function FreeTextCombobox({
  value,
  onChange,
  fetchSuggestions,
  placeholder,
  disabled,
}: FreeTextComboboxProps) {
  const [items, setItems] = useState<string[]>([])
  const [, startTransition] = useTransition()

  useEffect(() => {
    const query = value.trim()
    const timeout = setTimeout(() => {
      startTransition(async () => {
        try {
          const results = await fetchSuggestions(query)
          setItems(results)
        } catch {
          setItems([])
        }
      })
    }, 250)

    return () => clearTimeout(timeout)
  }, [value, fetchSuggestions])

  return (
    <Combobox<string>
      items={items}
      value={value || null}
      onValueChange={(next) => onChange(next ?? "")}
      inputValue={value}
      onInputValueChange={onChange}
      itemToStringLabel={(item) => item ?? ""}
      filter={null}
      disabled={disabled}
    >
      <ComboboxInput placeholder={placeholder} />
      {/* 추천할 최근 입력값이 없으면 목록 상자를 아예 띄우지 않는다
          ("없습니다" 상자가 아래 칩·칸을 가려서 잘못 누르게 되는 문제) */}
      {items.length > 0 ? (
        <ComboboxContent>
          <ComboboxList>
            {items.map((item) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      ) : null}
    </Combobox>
  )
}
