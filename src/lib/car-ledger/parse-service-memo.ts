/**
 * 예전 지출 비고(정비) → km · 정비소 · 항목 · 나머지 비고.
 * 백필(예전 자료 옮기기)에 쓰는 순수 함수. 실제 DB에 적용하는 일은 오케스트레이터가 한다.
 *
 * 예: "563,477km 엔진오일,리어라이닝 (3/3) · 완정모터스"
 *   → { km: 563477, vendor: "완정모터스", items: [엔진오일, 리어라이닝], rest: null }
 */

export interface ParsedServiceItem {
  name: string
  /** "엔진오일 80,000"처럼 이름 뒤에 금액이 붙어 있을 때만 */
  amount: number | null
}

export interface ParsedServiceMemo {
  km: number | null
  vendor: string | null
  items: ParsedServiceItem[]
  /** 항목으로 못 뽑은 설명(증상·고장코드·긴 내역). 없으면 null */
  rest: string | null
}

/** 정비소 이름 끝말 */
const VENDOR_SUFFIX = /(모터스|카센터|카센타|블루핸즈|오토큐|스피드메이트|공업사|정비소|정비|타이어|오토)$/
/** 그 자체로 정비소 이름인 상호 */
const VENDOR_BRAND = /^(블루핸즈|오토큐|스피드메이트)$/

/** 항목 이름 앞부분으로 알아볼 기본 정비 항목 (붙어 쓴 "엔진오일환영모터스" 나누기용) */
const DEFAULT_KNOWN_ITEMS = [
  "엔진오일",
  "미션오일",
  "데후오일",
  "타이어",
  "브레이크 라이닝",
  "브레이크 패드",
  "배터리",
  "에어필터",
  "에어컨필터",
  "와이퍼",
  "냉각수",
  "얼라인먼트",
]

/** km: "615,848km", "615848km", "615,848 km" (쉼표 있거나 4~7자리) */
const KM_PATTERN = /(?<![\d,])(\d{1,3}(?:,\d{3})+|\d{4,7})\s*km/i
/** 할부 표시 "(3/3)" */
const INSTALLMENT_PATTERN = /\(\s*\d+\s*\/\s*\d+\s*\)/g
/** 금액처럼 보이는 숫자 ("80,000") */
const MONEY_PATTERN = /\d{1,3}(?:,\d{3})+/
/** 항목 하나로 보기엔 너무 긴 길이 */
const MAX_ITEM_LENGTH = 30

const THOUSANDS_MARK = "\u0000"

function squash(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

/** 한 덩어리 전체가 정비소 이름처럼 보이는지 (구분자 뒤 덩어리용) */
function isVendorPhrase(segment: string, knownItems: readonly string[]): boolean {
  if (segment.includes(",") || segment.length > MAX_ITEM_LENGTH) return false
  if (knownItems.includes(segment)) return false
  const last = segment.split(" ").pop() ?? ""
  if (!VENDOR_SUFFIX.test(last)) return false
  // "타이어"처럼 항목과 같은 짧은 말 하나만 있으면 정비소로 보지 않는다
  return segment.includes(" ") || VENDOR_BRAND.test(last) || last.length >= 4
}

/** 항목 덩어리 끝에 붙은 한 단어가 정비소인지 ("엔진오일 환영모터스"의 "환영모터스") */
function isTrailingVendorToken(token: string, knownItems: readonly string[]): boolean {
  if (knownItems.includes(token) || token.length > MAX_ITEM_LENGTH) return false
  const match = VENDOR_SUFFIX.exec(token)
  if (!match) return false
  if (VENDOR_BRAND.test(token)) return true
  // 앞에 상호가 두 글자 이상 붙어 있어야 ("앞타이어"는 항목)
  return token.length - match[0].length >= 2
}

/** "1,234" 같은 천 단위 쉼표는 남기고 나머지 쉼표로 나눈다 */
function splitByComma(text: string): string[] {
  return text
    .replace(/(\d),(?=\d{3}(?!\d))/g, `$1${THOUSANDS_MARK}`)
    .split(",")
    .map((piece) => squash(piece.replaceAll(THOUSANDS_MARK, ",")))
    .filter(Boolean)
}

function isTooLong(piece: string): boolean {
  if (piece.length > MAX_ITEM_LENGTH) return true
  // 금액이 섞인 조각은 "이름 금액" 한 쌍일 때만 항목으로 본다
  const money = piece.match(new RegExp(MONEY_PATTERN, "g"))
  if (!money) return false
  return money.length > 1 || !new RegExp(`\\s${MONEY_PATTERN.source}$`).test(piece)
}

function toItem(piece: string): ParsedServiceItem {
  const match = /^(.+?)\s+(\d{1,3}(?:,\d{3})+)$/.exec(piece)
  if (match) return { name: match[1], amount: Number(match[2].replace(/,/g, "")) }
  return { name: piece, amount: null }
}

export function parseServiceMemo(
  memo: string | null | undefined,
  knownItems: readonly string[] = DEFAULT_KNOWN_ITEMS
): ParsedServiceMemo {
  let text = squash(memo ?? "")
  const result: ParsedServiceMemo = { km: null, vendor: null, items: [], rest: null }
  if (!text) return result

  // 1) 할부 표시는 버린다
  text = text.replace(INSTALLMENT_PATTERN, " ")

  // 2) km
  const km = KM_PATTERN.exec(text)
  if (km) {
    result.km = Number(km[1].replace(/,/g, ""))
    text = text.slice(0, km.index) + " " + text.slice(km.index + km[0].length)
  }

  // 3) " · " / " - " 로 덩어리를 나눈다
  const segments = text
    .split(/\s*·\s*|\s+-\s+/)
    .map(squash)
    .filter(Boolean)

  const restParts: string[] = []
  let itemSegment: string | null = null
  for (const [index, segment] of segments.entries()) {
    if (index > 0 && result.vendor === null && itemSegment !== null && isVendorPhrase(segment, knownItems)) {
      result.vendor = segment
    } else if (itemSegment === null) {
      itemSegment = segment
    } else {
      restParts.push(segment)
    }
  }

  // 4) 항목 덩어리: 끝 단어가 정비소면 떼고, 쉼표로 나눈다
  if (itemSegment !== null) {
    let segment = itemSegment
    if (result.vendor === null) {
      const tokens = segment.split(" ")
      const last = tokens[tokens.length - 1]
      if (tokens.length >= 2 && !segment.endsWith(",") && isTrailingVendorToken(last, knownItems)) {
        result.vendor = last
        segment = squash(tokens.slice(0, -1).join(" "))
      }
    }

    const pieces = splitByComma(segment)
    const restStart = pieces.findIndex(isTooLong)
    const itemPieces = restStart === -1 ? pieces : pieces.slice(0, restStart)
    if (restStart !== -1) restParts.unshift(pieces.slice(restStart).join(","))

    for (const piece of itemPieces) {
      // "엔진오일환영모터스"처럼 항목과 정비소가 붙어 있는 경우
      const known = knownItems.find((name) => piece.startsWith(name) && piece.length > name.length)
      const tail = known ? piece.slice(known.length).trim() : ""
      if (known && result.vendor === null && isVendorPhrase(tail, knownItems)) {
        result.items.push({ name: known, amount: null })
        result.vendor = tail
      } else {
        result.items.push(toItem(piece))
      }
    }
  }

  result.rest = restParts.length > 0 ? restParts.join(" · ") : null
  return result
}
