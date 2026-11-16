import {
  MAX_CATEGORY_NAME_LENGTH,
  normalizeCategoryName,
} from "@/lib/constants/expense-categories"

/** DB 행(정렬값·만든 시각)으로 카드 이름 순서를 정한다. */
export function sortCardNames(
  rows: readonly { name: string; sort_order: number; created_at: string }[]
): string[] {
  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    .map((row) => row.name)
}

/** 새 카드 이름이나 바꿀 이름을 검사한다 (길이·중복). current는 이름 바꾸기에서 지금 이름. */
export function checkCardName(
  names: readonly string[],
  rawName: string,
  current?: string
): { ok: true; name: string } | { ok: false; error: string } {
  const name = normalizeCategoryName(rawName)
  if (!name) return { ok: false, error: "이름을 입력하세요" }
  if (name.length > MAX_CATEGORY_NAME_LENGTH) {
    return { ok: false, error: `이름은 ${MAX_CATEGORY_NAME_LENGTH}자 이하로 입력하세요` }
  }
  if (name !== current && names.includes(name)) return { ok: false, error: "이미 있는 카드예요" }
  return { ok: true, name }
}

/** 카드를 한 칸 앞(-1)·뒤(+1)로 옮긴 새 순서 */
export function moveCardName(
  names: readonly string[],
  name: string,
  direction: -1 | 1
): { ok: true; names: string[] } | { ok: false; error: string } {
  const from = names.indexOf(name)
  if (from < 0) return { ok: false, error: "카드를 찾을 수 없어요" }
  const to = from + direction
  if (to < 0 || to >= names.length) {
    return { ok: false, error: direction < 0 ? "이미 맨 앞이에요" : "이미 맨 뒤예요" }
  }
  const next = [...names]
  ;[next[from], next[to]] = [next[to], next[from]]
  return { ok: true, names: next }
}

/**
 * 텔레그램 지출 메시지의 한 단어가 카드 이름인지. 띄어쓰기·대소문자는 무시한다
 * ("신한 RPM", "신한rpm" → "신한RPM"). 같은 게 없으면 null.
 */
export function matchCardName(names: readonly string[], token: string): string | null {
  const key = (value: string) => value.replace(/\s+/g, "").toLowerCase()
  const target = key(token)
  if (!target) return null
  return names.find((name) => key(name) === target) ?? null
}
