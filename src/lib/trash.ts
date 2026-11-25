/** 휴지통에 보이는 종류 (DB 표 이름과 짝) */
export type TrashKind = "dispatch" | "sale" | "expense" | "client" | "vehicle" | "memo" | "car_log"

export const TRASH_TABLE: Record<
  TrashKind,
  "dispatches" | "sales" | "expenses" | "clients" | "vehicles" | "memos" | "car_logs"
> = {
  dispatch: "dispatches",
  sale: "sales",
  expense: "expenses",
  client: "clients",
  vehicle: "vehicles",
  memo: "memos",
  car_log: "car_logs",
}

export const TRASH_KIND_LABEL: Record<TrashKind, string> = {
  sale: "매출",
  expense: "지출",
  dispatch: "배차",
  client: "거래처",
  vehicle: "차량",
  memo: "메모",
  car_log: "차계부",
}

/** 종류 꼬리표 색 — 앱의 메뉴 색(매출 파랑·지출 빨강·배차 노랑·차량 파랑·거래처 초록·메모 회색) */
export const TRASH_KIND_TAG: Record<TrashKind, string> = {
  sale: "bg-[#5b8fd9] text-white",
  expense: "bg-[#c65a55] text-[#fff3f2]",
  dispatch: "bg-[#d6a84a] text-[#241c0c]",
  vehicle: "bg-[#6f93cf] text-[#0f1a2c]",
  client: "bg-[#6aad83] text-[#0f2418]",
  memo: "bg-[#a1a1aa] text-[#18181b]",
  car_log: "bg-[#2a95a5] text-white",
}

/** 지운 지 이만큼 지나면 저절로 완전 삭제 (DB pg_cron 'bisang-trash-purge'와 같은 값) */
export const TRASH_KEEP_DAYS = 30

/** 완전 삭제까지 남은 날 (0이면 오늘 밤 지워짐) */
export function trashDaysLeft(deletedAt: string, now: Date = new Date()): number {
  const passed = Math.floor((now.getTime() - new Date(deletedAt).getTime()) / 86_400_000)
  return Math.max(0, TRASH_KEEP_DAYS - passed)
}

export type TrashItem = {
  kind: TrashKind
  id: string
  title: string
  sub: string
  deletedAt: string
  /** 다른 기록이 가리키고 있어 완전 삭제를 못 하는 거래처 */
  kept?: boolean
}
