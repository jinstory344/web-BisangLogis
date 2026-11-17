import { ChevronRight, Truck } from "lucide-react"
import Link from "next/link"

import { CallButton } from "@/components/common/call-button"
import { formatPhoneNumber } from "@/lib/phone"

/**
 * 검색어와 이름이 맞는 차량을 결과 맨 위에 카드로 (없으면 아무것도 안 그림). 카드를 누르면 차량 정보로 간다.
 * 거래처 카드는 거래처 페이지에서 바로 볼 수 있어 뺐다.
 */
export function EntityCards({
  vehicles,
}: {
  vehicles: { id: string; plate_no: string; driver_name: string; driver_phone: string | null }[]
}) {
  if (vehicles.length === 0) return null

  return (
    <div className="flex flex-col gap-2 pb-2">
      {vehicles.map((v) => (
        <div key={v.id} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5">
          <Link href={`/vehicles?q=${encodeURIComponent(v.plate_no)}`} className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Truck className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">
                {v.driver_name} <span className="font-normal">{v.plate_no}</span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                차량{v.driver_phone ? ` · ${formatPhoneNumber(v.driver_phone)}` : ""}
              </span>
            </span>
            <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
          </Link>
          {v.driver_phone ? <CallButton phone={v.driver_phone} label={`${v.driver_name}에게 전화`} /> : null}
        </div>
      ))}
    </div>
  )
}
