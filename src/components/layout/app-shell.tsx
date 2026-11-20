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
        {/* 컴퓨터 화면: 오른쪽 상세 패널(DetailSheet)이 있는 화면이면 그 폭만큼 비켜 준다 */}
        <main className="flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0 lg:has-[[data-detail-panel]]:pr-[400px]">
          {children}
          {/* 떠 있는 버튼(fixed)과 그 아래 빈칸 — 안에 두어야 목록 마지막 줄이 버튼에 가리지 않는다 */}
          <FloatingActions />
        </main>
      </div>
      {/* useSearchParams를 쓰는 클라이언트 컴포넌트라 Suspense로 감싼다 */}
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <MobileTabBar />
    </div>
  )
}
