import { FileSpreadsheet, Trash2, UserRound } from "lucide-react"
import type { Metadata } from "next"
import type { ReactNode } from "react"

import { createClient } from "@/lib/supabase/server"

import { LogoutButton } from "./logout-button"

export const metadata: Metadata = {
  title: "설정 · 비상로지스",
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="px-1 text-[13px] text-muted-foreground">{title}</h2>
      <div className="overflow-hidden rounded-xl border bg-card">{children}</div>
    </section>
  )
}

/** 아직 화면이 없는 항목: 흐리게 "준비 중" */
function SoonRow({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div
      aria-disabled
      className="flex h-12 items-center gap-3 border-b px-4 text-[15px] text-muted-foreground/60 last:border-b-0"
    >
      {icon}
      <span className="flex-1">{label}</span>
      <span className="text-xs">준비 중</span>
    </div>
  )
}

/**
 * 설정: 로그인 정보 · 관리(휴지통 · 엑셀 가져오기) · 로그아웃.
 * 로그아웃은 메뉴 맨 아래에서 자꾸 잘못 눌려서 이 화면 맨 아래로 옮겼다.
 */
export default async function SettingsPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null

  return (
    <div className="px-4 pb-8 md:p-6">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <header className="flex h-12 items-center justify-center pt-2">
          <h1 className="text-lg font-semibold">설정</h1>
        </header>

        <Section title="로그인 정보">
          <div className="flex items-center gap-3 px-4 py-3">
            <UserRound className="size-5 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">로그인한 계정</p>
              <p className="truncate text-[15px]">{email ?? "개발 모드 (로그인 없음)"}</p>
            </div>
          </div>
        </Section>

        <Section title="관리">
          <SoonRow icon={<Trash2 className="size-5" />} label="휴지통" />
          <SoonRow icon={<FileSpreadsheet className="size-5" />} label="엑셀 가져오기" />
        </Section>

        <Section title="계정">
          <LogoutButton />
        </Section>
      </div>
    </div>
  )
}
