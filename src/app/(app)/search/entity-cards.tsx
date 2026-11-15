import { Building2, ChevronRight, Truck } from "lucide-react"
import Link from "next/link"

import { CallButton } from "@/components/common/call-button"
import { formatPhoneNumber } from "@/lib/phone"

/**
 * 검색어와 이름이 맞는 거래처·차량을 결과 맨 위에 카드로 (없으면 아무것도 안 그림).
 * 카드에서 바로 전화하거나, 눌러서 그 거래처·차량 정보로 간다.
 */
export function EntityCards({
  clients,
  vehicles,
}: {
  clients: { id: string; name: string; contact_name: string | null; contact_phone: string | null }[]
  vehicles: { id: string; plate_no: string; driver_name: string; driver_phone: string | null }[]
}) {
  if (clients.length === 0 && vehicles.length === 0) return null
  const cards = [
    ...clients.map((c) => ({
      key: `c-${c.id}`,
      icon: <Building2 className="size-4" />,
      kind: "거래처",
      title: c.name,
      sub: [c.contact_name, c.contact_phone ? formatPhoneNumber(c.contact_phone) : null].filter(Boolean).join(" · "),
      phone: c.contact_phone,
      href: `/clients?q=${encodeURIComponent(c.name)}`,
    })),
    ...vehicles.map((v) => ({
      key: `v-${v.id}`,
      icon: <Truck className="size-4" />,
      kind: "차량",
      title: `${v.driver_name} ${v.plate_no}`,
      sub: v.driver_phone ? formatPhoneNumber(v.driver_phone) : "",
      phone: v.driver_phone,
      href: `/vehicles?q=${encodeURIComponent(v.plate_no)}`,
    })),
  ]
  return (
    <div className="flex flex-col gap-2 pb-2">
      {cards.map((card) => (
        <div key={card.key} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5">
          <Link href={card.href} className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {card.icon}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{card.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {card.kind}
                {card.sub ? ` · ${card.sub}` : ""}
              </span>
            </span>
            <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
          </Link>
          {card.phone ? <CallButton phone={card.phone} label={`${card.title}에 전화`} /> : null}
        </div>
      ))}
    </div>
  )
}
