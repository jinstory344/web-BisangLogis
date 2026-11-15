import { Building2, ChevronRight, Truck } from "lucide-react"
import Link from "next/link"

import { CallButton } from "@/components/common/call-button"
import { ContactRow } from "@/components/common/contact-row"
import { formatPhoneNumber } from "@/lib/phone"
import { searchHref, type SearchFilters, type SearchTab } from "@/lib/search"
import { cn } from "@/lib/utils"

type Contact = { name: string; phone: string | null }

/**
 * 검색어와 이름이 맞는 거래처·차량을 결과 맨 위에 카드로 (없으면 아무것도 안 그림).
 * 거래처 카드에는 담당자들이 한 줄씩(줄 끝 전화 버튼), 담당자가 둘 이상이면 [전체|이준호|이재근] 칩으로
 * 그 담당자의 배차만 볼 수 있다. 카드 제목을 누르면 거래처·차량 정보로 간다.
 */
export function EntityCards({
  clients,
  vehicles,
  contactsByClient,
  query,
  tab,
  period,
  filters,
}: {
  clients: { id: string; name: string; contact_name: string | null; contact_phone: string | null }[]
  vehicles: { id: string; plate_no: string; driver_name: string; driver_phone: string | null }[]
  contactsByClient: Record<string, Contact[]>
  query: string
  tab: SearchTab
  period: { from: string; to: string } | null
  filters: SearchFilters
}) {
  if (clients.length === 0 && vehicles.length === 0) return null

  return (
    <div className="flex flex-col gap-2 pb-2">
      {clients.map((client) => {
        const listed = contactsByClient[client.id] ?? []
        const contacts: Contact[] =
          listed.length > 0
            ? listed
            : client.contact_name
              ? [{ name: client.contact_name, phone: client.contact_phone }]
              : []
        const isThisClient = filters.clientId === client.id
        // 담당자 칩: 이 거래처로 거르고 담당자 이름까지 (배차 탭으로)
        const chipHref = (contact?: string) =>
          searchHref(isThisClient ? query : "", contact ? "dispatch" : tab === "expense" ? "all" : tab, period, {
            clientId: client.id,
            clientName: client.name,
            contact,
          })
        return (
          <div key={client.id} className="rounded-xl border bg-card px-3 py-2.5">
            <Link href={`/clients?q=${encodeURIComponent(client.name)}`} className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Building2 className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{client.name}</span>
                <span className="block text-xs text-muted-foreground">거래처 · 담당자 {contacts.length}명</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
            {contacts.length > 1 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[undefined, ...contacts.map((c) => c.name)].map((name) => {
                  const isOn = isThisClient && (filters.contact ?? undefined) === name
                  return (
                    <Link
                      key={name ?? "all"}
                      href={chipHref(name)}
                      replace
                      scroll={false}
                      className={cn(
                        "inline-flex h-8 items-center rounded-full px-3 text-[13px]",
                        isOn ? "bg-foreground font-semibold text-background" : "bg-muted text-foreground"
                      )}
                    >
                      {name ?? "전체"}
                    </Link>
                  )
                })}
              </div>
            ) : null}
            {contacts.length > 0 ? (
              <div className="mt-1">
                {contacts.map((c, i) => (
                  <ContactRow key={`${c.name}-${i}`} name={c.name} phone={c.phone} />
                ))}
              </div>
            ) : null}
          </div>
        )
      })}

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
