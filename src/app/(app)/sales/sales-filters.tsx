"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import type { ClientSearchResult } from "@/app/(app)/clients/actions"
import { ClientCombobox } from "@/components/clients/client-combobox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants/payment-method"
import {
  getCurrentMonthRangeInSeoul,
  getPreviousMonthRangeInSeoul,
} from "@/lib/date"

interface SalesFiltersProps {
  from: string
  to: string
  clientId: string
  clientName: string
  paymentStatus: string
  paymentMethod: string
}

/** 매출(재무 정보) 페이지 필터: 기간 + 거래처 + 입금여부 + 지불방법 */
export function SalesFilters({
  from,
  to,
  clientId,
  clientName,
  paymentStatus,
  paymentMethod,
}: SalesFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [dateFrom, setDateFrom] = useState(from)
  const [dateTo, setDateTo] = useState(to)
  const [client, setClient] = useState<ClientSearchResult | null>(
    clientId ? { id: clientId, name: clientName, biz_no: null } : null
  )

  function pushParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(next).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`)
  }

  function applyDateRange(range: { from: string; to: string }) {
    setDateFrom(range.from)
    setDateTo(range.to)
    pushParams({ from: range.from, to: range.to })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => applyDateRange(getCurrentMonthRangeInSeoul())}
        >
          이번 달
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => applyDateRange(getPreviousMonthRangeInSeoul())}
        >
          지난 달
        </Button>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          onBlur={() => pushParams({ from: dateFrom, to: dateTo })}
          className="w-auto"
        />
        <span className="text-muted-foreground">~</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          onBlur={() => pushParams({ from: dateFrom, to: dateTo })}
          className="w-auto"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-56">
          <ClientCombobox
            value={client}
            onChange={(next) => {
              setClient(next)
              pushParams({
                client_id: next?.id ?? "",
                client_name: next?.name ?? "",
              })
            }}
          />
        </div>

        <Select
          value={paymentStatus || "ALL"}
          onValueChange={(value) =>
            pushParams({ payment_status: value === "ALL" ? "" : value })
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">입금여부 전체</SelectItem>
            <SelectItem value="UNPAID">미입금</SelectItem>
            <SelectItem value="PAID">입금완료</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={paymentMethod || "ALL"}
          onValueChange={(value) =>
            pushParams({ payment_method: value === "ALL" ? "" : value })
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">지불방법 전체</SelectItem>
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
