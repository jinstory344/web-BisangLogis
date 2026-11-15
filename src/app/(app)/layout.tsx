import type { ReactNode } from "react"

import { AppShell } from "@/components/layout/app-shell"
import { RefreshIfStale } from "@/components/layout/service-worker"
import { createClient } from "@/lib/supabase/server"

export default async function AppLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = await createClient()
  // 미들웨어가 이미 로그인을 확인했으므로 여기서는 토큰을 로컬로 읽기만 한다
  // (getUser는 매번 인증 서버를 다시 부른다).
  const { data } = await supabase.auth.getClaims()
  const email = data?.claims?.email

  return (
    <AppShell userEmail={typeof email === "string" ? email : null}>
      {/* 폰에 저장해 둔 옛 화면(서비스 워커)으로 열렸으면 바로 최신으로 다시 그린다 — 어느 화면이든 */}
      <RefreshIfStale renderedAt={Date.now()} />
      {children}
    </AppShell>
  )
}
