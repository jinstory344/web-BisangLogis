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

/** 2.4 차량 자동완성: 선택 시 기사명·연락처 자동 채움, 직접 입력도 허용 */
export function VehicleCombobox({
  plateNo,
  onPlateNoChange,
  onVehicleSelected,
  disabled,
}: VehicleComboboxProps) {
  const [items, setItems] = useState<VehicleSearchResult[]>([])
  const [selected, setSelected] = useState<VehicleSearchResult | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    const query = plateNo.trim()
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
  }, [plateNo])

  function handleValueChange(next: VehicleSearchResult | null) {
    setSelected(next)
    onPlateNoChange(next?.plate_no ?? "")
    onVehicleSelected(next)
  }

  function handleInputValueChange(text: string) {
    onPlateNoChange(text)
    if (selected && text !== selected.plate_no) {
      setSelected(null)
      onVehicleSelected(null)
    }
  }

  return (
    <Combobox<VehicleSearchResult>
      items={items}
      value={selected}
      onValueChange={handleValueChange}
      inputValue={plateNo}
      onInputValueChange={handleInputValueChange}
      itemToStringLabel={(item) => item?.plate_no ?? ""}
      filter={null}
      disabled={disabled}
    >
      <ComboboxInput placeholder="차량번호 (직접 입력 가능)" />
      <ComboboxContent>
        <ComboboxList>
          {items.map((item) => (
            <ComboboxItem key={item.id} value={item}>
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
