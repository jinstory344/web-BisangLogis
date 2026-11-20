import type { Metadata } from "next"

import { getCurrentMonthRangeInSeoul } from "@/lib/date"

import { exportCountsAction } from "./actions"
import { ExportForm } from "./export-form"

export const metadata: Metadata = {
  title: "엑셀 내보내기 · 비상로지스",
}

export default async function ExportPage() {
  const month = getCurrentMonthRangeInSeoul()
  const counts = await exportCountsAction(month)
  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <ExportForm initialCounts={counts} />
    </div>
  )
}
