import { MessageSquare } from "lucide-react"
import type { ReactNode } from "react"

import { CallButton } from "@/components/common/call-button"
import { formatPhoneNumber } from "@/lib/phone"

/**
 * 연락처 한 줄: [왼쪽 제목] 이름·번호 ……… [전화 버튼]
 * 전화 버튼은 줄 오른쪽 끝에 세워 여러 줄이어도 세로로 가지런하고,
 * 제목·글자·버튼을 모두 줄 가운데 높이에 맞춘다(제목이 위로 붙어 어긋나 보이지 않게).
 */
export function ContactRow({
  label,
  name,
  extra,
  phone,
  labelWidthClassName = "w-14",
  sms = false,
}: {
  /** 전화 버튼 왼쪽에 빈 문자창 바로 열기 버튼도 둘지 */
  sms?: boolean
  /** 왼쪽 제목 (예: "담당자", "차량"). 없으면 제목 칸 없이 */
  label?: string
  name: ReactNode
  /** 이름 뒤에 붙일 것 (예: 차량번호) */
  extra?: ReactNode
  phone: string | null | undefined
  labelWidthClassName?: string
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 border-b py-1.5 text-sm last:border-b-0">
      {label ? <span className={`${labelWidthClassName} shrink-0 text-muted-foreground`}>{label}</span> : null}
      <span className="min-w-0 flex-1 break-words">
        <span className="font-medium">{name}</span>
        {extra ? <span> · {extra}</span> : null}
        {phone ? <span className="ml-1.5 text-muted-foreground tabular-nums">{formatPhoneNumber(phone)}</span> : null}
      </span>
      {phone && sms ? (
        <a
          href={`sms:${phone.replace(/[^\d+]/g, "")}`}
          aria-label={`${typeof name === "string" ? name : ""}에게 문자`}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300 active:bg-blue-500/25"
        >
          <MessageSquare className="size-4" aria-hidden />
        </a>
      ) : null}
      {phone ? <CallButton phone={phone} label={`${typeof name === "string" ? name : ""}에게 전화`} /> : null}
    </div>
  )
}
