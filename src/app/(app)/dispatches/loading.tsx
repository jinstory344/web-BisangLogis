import { PageLoading } from "@/components/list/page-loading"
import { SECTION_COLORS } from "@/lib/constants/section-colors"

export default function Loading() {
  return <PageLoading title="배차" barClassName={SECTION_COLORS.dispatch.titleBar} />
}
