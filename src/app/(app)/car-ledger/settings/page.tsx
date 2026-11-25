import type { Metadata } from "next"
import type { ReactNode } from "react"

import { FormPageHeader } from "@/components/form/form-page-header"
import { createClient } from "@/lib/supabase/server"

import { loadCarMasters } from "../data"
import { CarListEditor } from "./car-list-editor"
import { ItemListEditor } from "./item-list-editor"

export const metadata: Metadata = {
  title: "차계부 설정 · 비상로지스",
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="px-1 text-[13px] text-muted-foreground">{title}</h2>
      <div className="overflow-hidden rounded-xl border bg-card">{children}</div>
      {note ? <p className="px-1 text-xs text-muted-foreground">{note}</p> : null}
    </section>
  )
}

/** 차계부 설정: 차 · 정비 항목(트럭·승용차 공용) · 기록 종류(승용차) */
export default async function CarLedgerSettingsPage() {
  const supabase = await createClient()
  const masters = await loadCarMasters(supabase)

  return (
    <div className="px-4 pb-8 md:p-6">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <FormPageHeader title="차계부 설정" backHref="/car-ledger" backLabel="차계부" />

        {masters.error ? (
          <p className="text-sm text-destructive">차계부 목록을 불러오지 못했어요: {masters.error}</p>
        ) : null}

        <Section title="차" note="첫 번째 업무용 차에 지출(차량 › 정비·주유비·요소수)이 이어져요.">
          <CarListEditor cars={masters.cars} />
        </Section>

        <Section title="정비 항목" note="트럭·승용차가 함께 써요. 엔진오일·배터리처럼 정비할 때 고르는 칩이에요.">
          <ItemListEditor
            kind="service"
            items={masters.serviceItems.map((row) => ({ id: row.id, name: row.name }))}
            addLabel="항목 추가"
          />
        </Section>

        <Section title="기록 종류 (승용차)" note="주유·정비는 지울 수 없어요.">
          <ItemListEditor
            kind="log"
            items={masters.logKinds.map((row) => ({ id: row.id, name: row.name }))}
            addLabel="종류 추가"
          />
        </Section>
      </div>
    </div>
  )
}
