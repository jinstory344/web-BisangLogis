"use client"

import { ExternalLink, Search, X } from "lucide-react"
import { useState } from "react"

import type { ClientSearchResult } from "@/app/(app)/clients/actions"
import { ClientCombobox } from "@/components/clients/client-combobox"
import { TaxInfoBadge } from "@/components/clients/tax-info-badge"
import { ChoiceChips, chipVariants } from "@/components/form/choice-chips"
import { getTaxInfoStatus } from "@/lib/client-tax-info"
import { pickChipClients, type SaleClientChoice } from "@/lib/sale-clients"
import { cn } from "@/lib/utils"

/** 거래처로 연결되지 않은(예전에 이름만 적은) 소분류를 선택된 칩으로 보여 주기 위한 값 */
const UNLINKED_VALUE = "__unlinked__"

export interface PickedSaleClient {
  id: string
  name: string
}

interface ClientSourcePickerProps {
  /** 매출에서 많이 쓴 순으로 정렬된 전체 거래처 */
  choices: readonly SaleClientChoice[]
  /** 연결된 거래처 id ("" = 연결 없음) */
  clientId: string
  /** 저장된 소분류 이름 — 연결은 없고 이름만 있는 예전 건을 보여 주는 데 쓴다. */
  sourceMinor: string
  /** 거래처를 고르면 그 거래처, 선택을 해제하면 null */
  onChange: (client: PickedSaleClient | null) => void
}

/**
 * 매출 폼 출처 "거래처"의 소분류: 거래처 페이지에 등록된 명단에서 고른다.
 * 칩에는 내 거래처만 나오고(많이 쓴 순), 타 거래처나 칩에 안 보이는 거래처는 "다른 거래처 찾기"로
 * 검색하거나 없으면 이름만으로 바로 등록한다(구분은 타 거래처). 고른 거래처의 세금계산서 정보가
 * 비어 있으면 알려 주고 거래처 수정 화면으로 가는 링크를 준다.
 */
export function ClientSourcePicker({
  choices,
  clientId,
  sourceMinor,
  onChange,
}: ClientSourcePickerProps) {
  const [created, setCreated] = useState<SaleClientChoice[]>([])
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const allChoices = [
    ...choices,
    ...created.filter((c) => !choices.some((known) => known.id === c.id)),
  ]
  const displayed = pickChipClients(allChoices, clientId)
  const selected = allChoices.find((choice) => choice.id === clientId)
  const unlinkedName = !clientId ? sourceMinor.trim() : ""

  const options = [
    ...displayed.map((choice) => ({ value: choice.id, label: choice.name })),
    ...(unlinkedName ? [{ value: UNLINKED_VALUE, label: unlinkedName }] : []),
  ]
  const value = clientId || (unlinkedName ? UNLINKED_VALUE : "")

  function handleChipChange(next: string) {
    if (next === "" || next === UNLINKED_VALUE) {
      onChange(null)
      return
    }
    const choice = allChoices.find((c) => c.id === next)
    if (choice) onChange({ id: choice.id, name: choice.name })
  }

  function handleSearchPicked(client: ClientSearchResult | null) {
    if (!client) return

    // 목록에 없던 거래처(방금 즉석 등록한 곳)는 선택된 칩으로 보이도록 목록에 더한다.
    if (!allChoices.some((c) => c.id === client.id)) {
      setCreated((prev) => [
        ...prev,
        {
          id: client.id,
          name: client.name,
          category: "OTHER",
          taxStatus: getTaxInfoStatus({}),
        },
      ])
    }
    onChange({ id: client.id, name: client.name })
    setIsSearchOpen(false)
  }

  return (
    <div className="flex flex-col gap-2">
      {options.length > 0 ? (
        <ChoiceChips
          aria-label="출처 소분류 (거래처)"
          allowDeselect
          options={options}
          value={value}
          onChange={handleChipChange}
        />
      ) : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          aria-expanded={isSearchOpen}
          onClick={() => setIsSearchOpen((open) => !open)}
          className={cn(
            chipVariants({ selected: false }),
            "w-fit border-dashed"
          )}
        >
          {isSearchOpen ? <X /> : <Search />}
          {isSearchOpen ? "닫기" : "다른 거래처 찾기·등록"}
        </button>

        {isSearchOpen ? (
          <div className="flex flex-col gap-1">
            <ClientCombobox
              value={null}
              onChange={handleSearchPicked}
              newClientCategory="OTHER"
            />
            <p className="text-xs text-muted-foreground">
              목록에 없으면 이름을 입력하고 &quot;신규 등록&quot;을 누르면 바로
              등록돼요. 사업자 정보는 나중에 거래처에서 채우면 돼요.
            </p>
          </div>
        ) : null}
      </div>

      {selected ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <TaxInfoBadge status={selected.taxStatus} />
          {selected.taxStatus.level !== "complete" ? (
            <>
              <span className="text-muted-foreground">
                계산서를 발행할 때 필요해요.
              </span>
              <a
                href={`/clients/${selected.id}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-medium underline underline-offset-2"
              >
                거래처에서 입력
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </>
          ) : null}
        </div>
      ) : null}

      {unlinkedName ? (
        <p className="text-xs text-muted-foreground">
          &quot;{unlinkedName}&quot;은(는) 거래처로 연결되지 않은 이름이에요.
          위에서 거래처를 고르거나 찾아서 연결할 수 있어요.
        </p>
      ) : null}
    </div>
  )
}
