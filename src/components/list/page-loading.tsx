import type { ReactNode } from "react"

import { PageTitle } from "@/components/layout/page-title"
import { ListBodyFallback } from "@/components/list/list-body-fallback"

/**
 * 하단 탭을 누르는 즉시 보이는 틀(각 화면의 loading.tsx). 서버(뭄바이) 응답을 기다리는 동안
 * 이전 화면에 머무르지 않고 바로 그 화면의 제목 + 흐린 줄을 보여 준다.
 */
export function PageLoading({ title, barClassName }: { title: ReactNode; barClassName: string }) {
  return (
    <div aria-busy className="mx-auto max-w-2xl p-4 md:p-6">
      <div className="mt-2 grid h-10 grid-cols-[2.5rem_1fr_2.5rem] items-center md:mt-0">
        <span />
        <PageTitle title={title} barClassName={barClassName} />
        <span />
      </div>
      <div className="mt-5">
        <ListBodyFallback />
      </div>
    </div>
  )
}
