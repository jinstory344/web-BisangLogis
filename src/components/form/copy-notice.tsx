import { Copy } from "lucide-react"

/** 복사 등록(/{type}/new?copy=id) 화면 상단 안내 한 줄. */
export function CopyNotice() {
  return (
    <p
      role="status"
      className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm"
    >
      <Copy className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      이전 건을 복사했어요. 날짜는 오늘로 바꿨어요.
    </p>
  )
}
