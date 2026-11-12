import { parseCopyId } from "@/lib/quick-entry"

import { NewSaleBody } from "./new-sale-body"

export default async function NewSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string | string[] }>
}) {
  const { copy } = await searchParams

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">매출 등록</h1>
      <NewSaleBody copyId={parseCopyId(copy)} />
    </div>
  )
}
