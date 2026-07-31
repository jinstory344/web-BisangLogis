"use client"

import { useEffect, useState, useTransition } from "react"

import {
  searchClientsAction,
  quickCreateClientAction,
  type ClientSearchResult,
} from "@/app/(app)/clients/actions"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatBizNo } from "@/lib/biz-no"

interface ClientComboboxProps {
  value: ClientSearchResult | null
  onChange: (client: ClientSearchResult | null) => void
  disabled?: boolean
}

const MIN_QUERY_LENGTH = 2

/** 2.2 거래처 자동완성: 사업자명 2글자 이상 입력 시 검색, 미등록 시 즉시 신규 등록 */
export function ClientCombobox({
  value,
  onChange,
  disabled,
}: ClientComboboxProps) {
  const [inputValue, setInputValue] = useState(value?.name ?? "")
  const [items, setItems] = useState<ClientSearchResult[]>([])
  const [, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState("")
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

  function handleValueChange(next: ClientSearchResult | null) {
    onChange(next)
    setInputValue(next?.name ?? "")
  }

  function openCreateDialog() {
    setNewName(inputValue.trim())
    setDialogOpen(true)
  }

  async function handleQuickCreate() {
    const name = newName.trim()
    if (!name) return

    setIsCreating(true)
    try {
      const created = await quickCreateClientAction(name)
      onChange(created)
      setInputValue(created.name)
      setDialogOpen(false)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <>
      <Combobox<ClientSearchResult>
        items={items}
        value={value}
        onValueChange={handleValueChange}
        inputValue={inputValue}
        onInputValueChange={setInputValue}
        itemToStringLabel={(item) => item?.name ?? ""}
        filter={null}
        disabled={disabled}
      >
        <ComboboxInput placeholder="거래처명 2글자 이상 입력" />
        <ComboboxContent>
          <ComboboxList>
            {items.map((item) => (
              <ComboboxItem key={item.id} value={item}>
                {item.name}
                {item.biz_no ? ` (${formatBizNo(item.biz_no)})` : ""}
              </ComboboxItem>
            ))}
          </ComboboxList>
          <ComboboxEmpty>
            <div className="flex flex-col items-center gap-2 py-4">
              <p className="text-sm text-muted-foreground">
                일치하는 거래처가 없습니다
              </p>
              {inputValue.trim().length >= MIN_QUERY_LENGTH ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={openCreateDialog}
                >
                  &quot;{inputValue.trim()}&quot; 신규 등록
                </Button>
              ) : null}
            </div>
          </ComboboxEmpty>
        </ComboboxContent>
      </Combobox>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>신규 거래처 등록</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="quick-client-name">사업자명</Label>
            <Input
              id="quick-client-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              사업자번호 등 나머지 정보는 거래처 관리 화면에서 나중에 입력할 수
              있습니다.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={handleQuickCreate}
              disabled={isCreating || !newName.trim()}
            >
              {isCreating ? "등록 중..." : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
