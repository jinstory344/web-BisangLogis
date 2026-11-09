"use client"

import { useEffect, useRef, useState, useTransition } from "react"

import {
  searchVehiclesAction,
  type VehicleSearchResult,
} from "@/app/(app)/vehicles/actions"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

interface VehicleComboboxProps {
  /** 차량번호 텍스트 (등록되지 않은 값도 자유 입력 가능 — plate_no_snapshot) */
  plateNo: string
  onPlateNoChange: (plateNo: string) => void
  /**
   * 목록에서 등록 차량을 선택했을 때만 호출된다.
   * 기사명·연락처 자동 채움에 사용한다. 자유 입력으로 전환되면 null로 호출된다.
   */
  onVehicleSelected: (vehicle: VehicleSearchResult | null) => void
  disabled?: boolean
}

const MIN_QUERY_LENGTH = 1

/**
 * 2.4 차량 자동완성: 선택 시 기사명·연락처 자동 채움, 직접 입력도 허용.
 * base-ui Combobox의 `value`를 등록 차량 객체로 두면(선택되지 않은 자유 입력 시
 * value=null) 포커스가 빠져나갈 때 라이브러리가 inputValue를 value의 라벨("")로
 * 되돌려 입력한 텍스트가 사라진다. value/inputValue를 항상 같은 문자열로 유지해
 * (거래처/상차지 콤보박스와 동일한 방식) 되돌아갈 대상 자체를 없앤다.
 */
export function VehicleCombobox({
  plateNo,
  onPlateNoChange,
  onVehicleSelected,
  disabled,
}: VehicleComboboxProps) {
  const [inputValue, setInputValue] = useState(plateNo)
  const [items, setItems] = useState<VehicleSearchResult[]>([])
  const [, startTransition] = useTransition()

  useEffect(() => {
    const query = inputValue.trim()
    if (query.length < MIN_QUERY_LENGTH) {
      setItems([])
      return
    }

    const timeout = setTimeout(() => {
      startTransition(async () => {
        try {
          const results = await searchVehiclesAction(query)
          setItems(results)
        } catch {
          setItems([])
        }
      })
    }, 250)

    return () => clearTimeout(timeout)
  }, [inputValue])

  // 등록 차량 일치 여부로 기사명·연락처·vehicle_id를 자동 채움/비움하는 것은 사용자가
  // 차량번호를 직접 입력하거나 목록에서 고른 뒤에만 한다.
  // 수정·복사 화면처럼 기존 스냅샷이 채워진 채로 열릴 때, 마운트 직후(개발 모드 StrictMode의
  // 이펙트 이중 실행 포함)나 첫 검색 결과가 도착한 시점에 "일치하는 등록 차량 없음"으로
  // 판단해 스냅샷을 지우거나(직접 입력했던 미등록 번호) 마스터 값으로 덮어쓰지 않기 위함이다.
  // (예전의 "마운트 첫 실행만 건너뛰기"는 검색 결과 도착 후의 두 번째 실행을 막지 못했다.)
  const hasUserEditedRef = useRef(false)
  useEffect(() => {
    if (!hasUserEditedRef.current) return
    const matched = items.find((item) => item.plate_no === inputValue) ?? null
    onVehicleSelected(matched)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, inputValue])

  function handleTextChange(text: string) {
    // 라이브러리가 포커스 이동 등으로 같은 값을 다시 알려주는 경우는 사용자 입력으로 보지 않는다.
    if (text !== inputValue) hasUserEditedRef.current = true
    setInputValue(text)
    onPlateNoChange(text)
  }

  function handleSelect(next: string | null) {
    const text = next ?? ""
    hasUserEditedRef.current = true
    // 이미 입력된 번호와 같은 차량을 목록에서 다시 고르면 inputValue가 그대로라 위 이펙트가
    // 돌지 않으므로, 기사 정보를 여기서 직접 다시 채운다.
    if (text === inputValue) {
      const matched = items.find((item) => item.plate_no === text)
      if (matched) onVehicleSelected(matched)
    }
    handleTextChange(text)
  }

  return (
    <Combobox<string>
      items={items.map((item) => item.plate_no)}
      value={inputValue || null}
      onValueChange={handleSelect}
      inputValue={inputValue}
      onInputValueChange={handleTextChange}
      itemToStringLabel={(item) => item ?? ""}
      filter={null}
      disabled={disabled}
    >
      <ComboboxInput placeholder="차량번호" />
      <ComboboxContent>
        <ComboboxList>
          {items.map((item) => (
            <ComboboxItem key={item.id} value={item.plate_no}>
              {item.plate_no} ({item.driver_name})
            </ComboboxItem>
          ))}
        </ComboboxList>
        <ComboboxEmpty>
          <p className="py-4 text-center text-sm text-muted-foreground">
            등록된 차량이 없습니다. 직접 입력한 번호로 저장됩니다.
          </p>
        </ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  )
}
