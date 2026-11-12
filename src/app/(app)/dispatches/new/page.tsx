import { parseCopyId } from "@/lib/quick-entry"

import { NewDispatchBody } from "./new-dispatch-body"

export default async function NewDispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string | string[] }>
}) {
  const { copy } = await searchParams

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold">배차 등록</h1>
      <NewDispatchBody copyId={parseCopyId(copy)} />
    </div>
  )
}
