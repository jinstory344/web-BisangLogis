import type { ReactNode } from "react"

import { MobileTabBar } from "./mobile-tab-bar"
import { Sidebar } from "./sidebar"

export function AppShell({
  userEmail,
  children,
}: {
  userEmail: string | null
  children: ReactNode
}) {
  return (
    <div className="flex min-h-svh">
      <Sidebar userEmail={userEmail} />
      <div className="flex flex-1 flex-col">
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
      </div>
      <MobileTabBar userEmail={userEmail} />
    </div>
  )
}
