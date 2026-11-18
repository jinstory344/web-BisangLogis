/**
 * 거래처 이름의 첫 단어가 같은 곳끼리 묶는다 (예: "조은푸드 육대장"·"조은푸드 이화수" → "조은푸드" 2곳).
 * 두 곳 이상인 묶음만 돌려준다. 거래처 정보를 따로 고치지 않아도 되게 이름만으로 정한다.
 */
export function groupClientsByFirstWord<T extends { id: string; name: string }>(
  clients: readonly T[]
): { name: string; ids: string[] }[] {
  const byWord = new Map<string, string[]>()
  for (const client of clients) {
    const parts = client.name.trim().split(/\s+/)
    if (parts.length < 2) continue
    const word = parts[0]
    byWord.set(word, [...(byWord.get(word) ?? []), client.id])
  }
  return [...byWord.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .map(([name, ids]) => ({ name, ids }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"))
}

/** 거래처 id → 묶음 이름 (묶음에 든 거래처만) */
export function clientGroupMap<T extends { id: string; name: string }>(clients: readonly T[]): Map<string, string> {
  return new Map(groupClientsByFirstWord(clients).flatMap((g) => g.ids.map((id) => [id, g.name] as const)))
}

export type ClientUnit<T> = { kind: "one"; item: T } | { kind: "group"; name: string; items: T[] }

/** 목록을 줄 단위로: 같은 묶음은 처음 나온 자리에 한 줄로 모은다 */
export function collapseByGroup<T extends { id: string }>(
  items: readonly T[],
  groupOf: ReadonlyMap<string, string>
): ClientUnit<T>[] {
  const units: ClientUnit<T>[] = []
  const byName = new Map<string, T[]>()
  for (const item of items) {
    const name = groupOf.get(item.id)
    if (!name) {
      units.push({ kind: "one", item })
      continue
    }
    const existing = byName.get(name)
    if (existing) existing.push(item)
    else {
      const list = [item]
      byName.set(name, list)
      units.push({ kind: "group", name, items: list })
    }
  }
  return units
}

/** 여러 곳을 한꺼번에 고정 켜기·끄기. 하나라도 고정돼 있으면 모두 풀고, 아니면 맨 아래에 모두 붙인다. 개수를 넘으면 null. */
export function togglePinnedMany(pinned: string[], ids: string[], max: number): string[] | null {
  if (ids.some((id) => pinned.includes(id))) return pinned.filter((id) => !ids.includes(id))
  if (pinned.length + ids.length > max) return null
  return [...pinned, ...ids]
}

/** 고정 순서에서 id가 든 줄(묶음이면 묶음 통째로)을 한 칸 위(-1)·아래(+1)로 */
export function movePinnedUnit(
  pinned: string[],
  groupOf: ReadonlyMap<string, string>,
  id: string,
  delta: -1 | 1
): string[] {
  const units = collapseByGroup(pinned.map((x) => ({ id: x })), groupOf).map((u) =>
    u.kind === "one" ? [u.item.id] : u.items.map((i) => i.id)
  )
  const from = units.findIndex((ids) => ids.includes(id))
  const to = from + delta
  if (from < 0 || to < 0 || to >= units.length) return pinned
  ;[units[from], units[to]] = [units[to], units[from]]
  return units.flat()
}
