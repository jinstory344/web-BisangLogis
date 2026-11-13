"use client"

import { useEffect, useMemo, useState } from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { filterSuggestions } from "@/lib/korean-match"

interface FreeTextComboboxProps {
  value: string
  onChange: (value: string) => void
  /** 최근 입력값 목록(최근 순)을 돌려준다. 화면이 열릴 때 한 번만 부른다. */
  fetchSuggestions: () => Promise<string[]>
  placeholder?: string
  disabled?: boolean
}

/**
 * 항상 자유 입력을 허용하되, 최근 입력값을 제안하는 콤보박스.
 * 7.3 상차지/하차지 "최근 입력값 자동완성"용.
 * - 칸을 누르기만 했을 때(빈 칸)는 아무것도 띄우지 않는다.
 * - 친 글자로 "시작하는" 값만 띄운다. 한글은 치는 도중도 맞춘다(ㅂ → 부산, 붓 → 부산).
 * 최근 값 목록은 처음에 한 번 받아 두고, 거르기는 글자를 칠 때마다 화면에서 바로 한다.
 */
export function FreeTextCombobox({
  value,
  onChange,
  fetchSuggestions,
  placeholder,
  disabled,
}: FreeTextComboboxProps) {
  const [pool, setPool] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    fetchSuggestions()
      .then((results) => {
        if (!cancelled) setPool(results)
      })
      .catch(() => {
        if (!cancelled) setPool([])
      })
    return () => {
      cancelled = true
    }
  }, [fetchSuggestions])

  const items = useMemo(() => filterSuggestions(pool, value), [pool, value])

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
