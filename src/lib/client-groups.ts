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
