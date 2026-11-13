import { ChevronLeft, X } from "lucide-react"
import Link from "next/link"

import { ENTRY_TYPES, parseEntryType } from "@/lib/entry-type"
import { parseCopyId } from "@/lib/quick-entry"

import { NewDispatchBody } from "../dispatches/new/new-dispatch-body"
import { NewExpenseBody } from "../expenses/new/new-expense-body"
import { NewSaleBody } from "../sales/new/new-sale-body"

import { EntryTypeToggle } from "./entry-type-toggle"

/**
 * 통합 등록 화면: 오른쪽 아래 ＋ 버튼으로 연다. 위쪽에서 매출 · 지출 · 배차를 바꿔 가며 등록한다
 * (가계부 앱의 수입 · 지출 · 이체 화면처럼). `?copy=id`면 그 건을 복사해 채운다.
 */
export default async function NewEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[]; copy?: string | string[] }>
}) {
  const params = await searchParams
  const type = parseEntryType(params.type, "sale")
  const copyId = parseCopyId(params.copy)
  const label = ENTRY_TYPES.find((t) => t.value === type)?.label ?? ""

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center">
          {/* 뒤로 가기: 누르기 쉽게 글씨·화살표를 키운다 (제목보다는 조금 작게) */}
          <Link
            href="/"
            className="-ml-2 flex h-12 w-fit items-center gap-0.5 pr-3 text-base font-medium text-foreground/80"
          >
            <ChevronLeft className="size-6" />
            HOME
          </Link>
          <h1 className="text-lg font-semibold">{label} 등록</h1>
          <Link
            href="/"
            aria-label="닫기"
            className="-mr-2 flex size-12 items-center justify-center justify-self-end text-foreground/80"
          >
            <X className="size-6" />
          </Link>
        </header>

        <EntryTypeToggle value={type} />

        {/* 종류를 바꾸거나 다른 건을 복사하면 폼 상태를 새로 만든다. */}
        <div key={`${type}-${copyId ?? "new"}`}>
          {type === "sale" ? (
            <NewSaleBody copyId={copyId} />
          ) : type === "expense" ? (
            <NewExpenseBody copyId={copyId} />
          ) : (
            <NewDispatchBody copyId={copyId} />
          )}
        </div>
      </div>
    </div>
  )
}
