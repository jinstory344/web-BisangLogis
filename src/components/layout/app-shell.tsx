import { Suspense, type ReactNode } from "react"

import { FloatingActions } from "./floating-actions"
import { MobileTabBar } from "./mobile-tab-bar"
import { NavigationProgress } from "./navigation-progress"
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
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
      </div>
      {/* useSearchParams를 쓰는 클라이언트 컴포넌트라 Suspense로 감싼다 */}
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <FloatingActions />
      <MobileTabBar userEmail={userEmail} />
    </div>
  )
}
