/**
 * 입력칸 추천용 "~로 시작" 비교 (한글 입력 도중의 글자도 맞춘다).
 *
 * - "ㅂ"     → "부산", "반월"처럼 첫소리가 ㅂ인 것
 * - "부"     → "부산", "북항"처럼 "부"로 시작하는(받침 유무 상관없이) 것
 * - "붓"     → "부산" (부+ㅅ을 친 순간: 받침 ㅅ이 다음 글자의 첫소리가 될 수 있다)
 * - "보"     → "봐", "뵈" (겹모음을 치는 도중)
 * - "ㅂㅅ"   → "부산" (첫소리만 친 경우)
 * 영문은 대소문자를 가리지 않는다.
 */

const SYLLABLE_BASE = 0xac00
const SYLLABLE_LAST = 0xd7a3

const INITIALS = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
]
const MEDIALS = [
  "ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ",
  "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ",
]
const FINALS = [
  "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ",
  "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
]

/** 겹받침 → [앞 받침, 다음 글자 첫소리] */
const SPLIT_FINALS: Record<string, [string, string]> = {
  ㄳ: ["ㄱ", "ㅅ"], ㄵ: ["ㄴ", "ㅈ"], ㄶ: ["ㄴ", "ㅎ"], ㄺ: ["ㄹ", "ㄱ"],
  ㄻ: ["ㄹ", "ㅁ"], ㄼ: ["ㄹ", "ㅂ"], ㄽ: ["ㄹ", "ㅅ"], ㄾ: ["ㄹ", "ㅌ"],
  ㄿ: ["ㄹ", "ㅍ"], ㅀ: ["ㄹ", "ㅎ"], ㅄ: ["ㅂ", "ㅅ"],
}

/** 모음 하나를 더 치면 될 수 있는 겹모음 */
const MEDIAL_EXTENSIONS: Record<string, string[]> = {
  ㅗ: ["ㅘ", "ㅙ", "ㅚ"],
  ㅜ: ["ㅝ", "ㅞ", "ㅟ"],
  ㅡ: ["ㅢ"],
}

interface Syllable {
  initial: string
  medial: string
  final: string
}

function decompose(char: string): Syllable | null {
  const code = char.charCodeAt(0)
  if (code < SYLLABLE_BASE || code > SYLLABLE_LAST) return null
  const index = code - SYLLABLE_BASE
  return {
    initial: INITIALS[Math.floor(index / 588)],
    medial: MEDIALS[Math.floor((index % 588) / 28)],
    final: FINALS[index % 28],
  }
}

function isInitialJamo(char: string): boolean {
  return INITIALS.includes(char)
}

/** 후보 글자의 첫소리 (한글 음절이 아니면 글자 그대로) */
function initialOf(char: string | undefined): string | null {
  if (!char) return null
  return decompose(char)?.initial ?? char
}

/** 입력 중간 글자: 그대로 같거나, 첫소리만 친 경우 첫소리가 같으면 맞다 */
function matchesMiddle(q: string, c: string | undefined): boolean {
  if (c === undefined) return false
  if (q === c) return true
  return isInitialJamo(q) && initialOf(c) === q
}

/**
 * 입력의 마지막 글자(아직 치는 중일 수 있는 글자) 비교.
 * next는 후보에서 그 다음 글자 (받침이 다음 글자 첫소리로 넘어가는 경우를 본다).
 */
function matchesLast(q: string, c: string | undefined, next: string | undefined): boolean {
  if (c === undefined) return false
  if (q === c) return true
  if (isInitialJamo(q)) return initialOf(c) === q

  const qs = decompose(q)
  const cs = decompose(c)
  if (!qs || !cs || qs.initial !== cs.initial) return false

  if (qs.medial !== cs.medial) {
    // "보" → "봐": 받침 없이 겹모음을 치는 중
    return qs.final === "" && (MEDIAL_EXTENSIONS[qs.medial] ?? []).includes(cs.medial)
  }

  if (qs.final === "") return true // "부" → "부", "북", "붕"…
  if (qs.final === cs.final) return true

  // "붓" → "부산": 받침이 다음 글자의 첫소리
  if (cs.final === "" && initialOf(next) === qs.final) return true

  // "달" → "닭": 받침을 겹받침으로 치는 중
  const split = SPLIT_FINALS[cs.final]
  if (split && split[0] === qs.final) return true

  // "닭" → "달걀": 겹받침의 뒤쪽이 다음 글자의 첫소리
  const qsSplit = SPLIT_FINALS[qs.final]
  if (qsSplit && cs.final === qsSplit[0] && initialOf(next) === qsSplit[1]) return true

  return false
}

/** candidate가 query로 시작하는지 (한글 입력 도중 포함). 빈 입력은 맞지 않는다. */
export function startsWithKorean(candidate: string, query: string): boolean {
  const q = [...query.trim().toLowerCase()]
  const c = [...candidate.trim().toLowerCase()]
  if (q.length === 0) return false
  for (let i = 0; i < q.length - 1; i += 1) {
    if (!matchesMiddle(q[i], c[i])) return false
  }
  const last = q.length - 1
  return matchesLast(q[last], c[last], c[last + 1])
}

/**
 * 추천 목록 거르기: 입력이 비어 있으면 아무것도 보여 주지 않고(칸만 눌렀을 때 목록이 덮지 않게),
 * 입력으로 시작하는 것만 원래 순서(최근 순)대로 최대 limit개. 입력과 똑같은 값은 뺀다.
 */
export function filterSuggestions(
  pool: readonly string[],
  query: string,
  limit = 8
): string[] {
  const trimmed = query.trim()
  if (!trimmed) return []
  return pool
    .filter((item) => item.trim() !== trimmed && startsWithKorean(item, trimmed))
    .slice(0, limit)
}
