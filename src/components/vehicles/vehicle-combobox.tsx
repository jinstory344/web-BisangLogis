"use client"

import { useEffect, useState, useTransition } from "react"

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

  useEffect(() => {
    const matched = items.find((item) => item.plate_no === inputValue) ?? null
    onVehicleSelected(matched)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, inputValue])

  function handleTextChange(text: string) {
    setInputValue(text)
    onPlateNoChange(text)
  }

  return (
    <Combobox<string>
      items={items.map((item) => item.plate_no)}
      value={inputValue || null}
      onValueChange={(next) => handleTextChange(next ?? "")}
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
