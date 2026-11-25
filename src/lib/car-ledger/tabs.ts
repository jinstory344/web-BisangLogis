import { BUSINESS_KINDS, SERVICE_KIND } from "./constants"
import { CYCLE_TAB, SERVICE_TAB } from "./url"

export interface CarTab {
  value: string
  label: string
}

/**
 * 막대·범례에 쓰는 종류 순서.
 * 업무용 차: 정비·주유·요소수 (지출 기반). 개인 차: 기록 종류 목록 순서.
 * 목록에 없는 종류(지운 종류의 옛 기록)는 기록이 있으면 뒤에 붙인다.
 */
export function carKindOrder(
  carKind: "business" | "personal",
  logKindNames: readonly string[],
  presentKinds: readonly string[]
): string[] {
  const base = carKind === "business" ? [...BUSINESS_KINDS] : [...logKindNames]
  if (!base.includes(SERVICE_KIND)) base.unshift(SERVICE_KIND)
  for (const kind of presentKinds) if (!base.includes(kind)) base.push(kind)
  return base
}

/** 탭: 정비 | 교체 주기 | (정비 외 종류들) */
export function carTabs(kindOrder: readonly string[]): CarTab[] {
  return [
    { value: SERVICE_TAB, label: "정비" },
    { value: CYCLE_TAB, label: "교체 주기" },
    ...kindOrder.filter((kind) => kind !== SERVICE_KIND).map((kind) => ({ value: kind, label: kind })),
  ]
}

/** 주소의 tab 값 검증: 모르는 값이면 정비 탭 */
export function parseCarTab(raw: string, tabs: readonly CarTab[]): string {
  return tabs.some((tab) => tab.value === raw) ? raw : SERVICE_TAB
}
