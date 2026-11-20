import type { PaymentMethod } from "@/lib/supabase/database.types"

/**
 * 텔레그램 봇 메시지 → 매출 등록 값.
 * 줄 순서를 외우지 않아도 되게, 줄 모양으로 무엇인지 알아본다:
 * 금액(75만) · 날짜(11/14, 어제) · 지불방법(계산서/이체/현금) · 출처(지인,마상구 / 카톡,스마일 / 우영)
 * · 사업자 정보(세금 주주부린물류)는 아무 줄에나,
 * 나머지 줄은 위에서부터 상차지 → 하차지 (그 뒤 줄은 비고).
 */

export type EntryKind = "sale" | "expense" | "dispatch"

export type SaleSourceOption = { major: string; sub: string | null }
export type ClientOption = { id: string; name: string }

export type ParsedSale = {
  sale_date: string
  origin: string
  destination: string
  supply_amount: number
  payment_method: PaymentMethod
  source_major: string | null
  source_sub: string | null
  source_minor: string | null
  client_id: string | null
  /** 사업자 정보(계산서 받을 상호) — "세금 주주부린물류" 줄에서 */
  billing_entity_name: string | null
  memo: string | null
  /** 물량(화물) "냉동3p" — 배차 메시지처럼 "냉동 3, 1.0"을 쓰면 */
  cargo_note: string | null
  /** 중량(톤) */
  weight_ton: number | null
  /** 담당자 — "아토 이준호"의 이준호 */
  contact_name: string | null
  /** 담당자 연락처 — 그 줄에 쓴 번호(없으면 봇이 거래처 담당자 목록에서 찾아 채운다) */
  contact_phone: string | null
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

const KIND_WORDS: Record<string, EntryKind> = {
  매출: "sale",
  매: "sale",
  지출: "expense",
  지: "expense",
  배차: "dispatch",
  배: "dispatch",
  // 초성만: ㅁㅊ·ㅈㅊ·ㅂㅊ
  ㅁㅊ: "sale",
  ㅈㅊ: "expense",
  ㅂㅊ: "dispatch",
}

/** 첫 줄로 종류를 정한다. 모르는 말이면 null. */
export function detectKind(firstLine: string): EntryKind | null {
  return KIND_WORDS[firstLine.replace(/\s/g, "")] ?? null
}

export const MAX_AMOUNT = 99_999_999_999 // PRD 4.3 상한

const PAYMENT_WORDS: Record<string, PaymentMethod> = {
  세금: "TAX_INVOICE",
  계산서: "TAX_INVOICE",
  세금계산서: "TAX_INVOICE",
  전자계산서: "TAX_INVOICE",
  이체: "TRANSFER",
  계좌이체: "TRANSFER",
  현금: "CASH",
}

/** "75만", "750,000", "1.5만", "75만원", "5천" → 원 단위 정수. 아니면 null. */
export function parseAmountToken(token: string): number | null {
  const m = token.match(/^(\d[\d,]*(?:\.\d+)?)(만|천)?원?$/)
  if (!m) return null
  const number = Number(m[1].replace(/,/g, ""))
  if (!Number.isFinite(number)) return null
  if (!m[2] && !Number.isInteger(number)) return null // 소수는 만·천 단위일 때만
  const unit = m[2] === "만" ? 10_000 : m[2] === "천" ? 1_000 : 1
  return Math.round(number * unit)
}

/** 금액·지불방법만 있는 줄이면 그 값을, 아니면 null ("75만", "75만 이체", "현금") */
function parseMoneyLine(
  line: string
): { amount: number | null; payment: PaymentMethod | null } | null {
  let amount: number | null = null
  let payment: PaymentMethod | null = null
  for (const token of line.split(/\s+/)) {
    const pay = PAYMENT_WORDS[token]
    if (pay) {
      payment = pay
      continue
    }
    const value = parseAmountToken(token)
    if (value === null || amount !== null) return null
    amount = value
  }
  return amount === null && payment === null ? null : { amount, payment }
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

export function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function validDate(y: number, m: number, d: number): string | null {
  const iso = `${y}-${pad(m)}-${pad(d)}`
  const check = new Date(`${iso}T00:00:00Z`)
  return check.getUTCMonth() + 1 === m && check.getUTCDate() === d ? iso : null
}

/** "오늘/어제/그제", "11/14", "11월 14일", "2026-11-14" (요일 괄호는 무시) → YYYY-MM-DD */
export function parseDateLine(line: string, today: string): string | null {
  const text = line.replace(/\s*\(.*\)\s*$/, "").replace(/\s/g, "")
  if (text === "오늘") return today
  if (text === "어제") return shiftDays(today, -1)
  if (text === "그제" || text === "그저께") return shiftDays(today, -2)

  const full = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/)
  if (full) return validDate(Number(full[1]), Number(full[2]), Number(full[3]))

  const short =
    text.match(/^(\d{1,2})\/(\d{1,2})$/) ??
    text.match(/^(\d{1,2})월(\d{1,2})일?$/)
  if (!short) return null
  const year = Number(today.slice(0, 4))
  const date = validDate(year, Number(short[1]), Number(short[2]))
  if (!date) return null
  // 1월 초에 "12/30"처럼 쓰면 작년으로 본다
  return date > shiftDays(today, 31) ? validDate(year - 1, Number(short[1]), Number(short[2])) : date
}

/**
 * 종류 단어 바로 아래 첫 줄의 숫자만 쓴 날짜 → "11/23" 모양으로.
 * "1123", "923"(9/23), "11 23", "11.23", "11,23". 날짜가 아니면 그대로.
 * 첫 줄에만 쓴다 — 다른 줄의 "1123"은 금액일 수 있어서.
 */
export function normalizeLeadingDate(lines: string[]): string[] {
  const [first, ...rest] = lines
  if (first === undefined) return lines
  const m = first.trim().match(/^(\d{1,2})[\s.,](\d{1,2})$/) ?? first.trim().match(/^(\d{1,2})(\d{2})$/)
  if (!m) return lines
  const month = Number(m[1])
  const day = Number(m[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return lines
  return [`${month}/${day}`, ...rest]
}

const SOURCE_ALIASES: Record<string, string> = {
  카톡: "카카오톡",
  카카오: "카카오톡",
  "24시": "24시콜화물",
  "24시콜": "24시콜화물",
}

export function squash(text: string): string {
  return text.replace(/\s/g, "").toLowerCase()
}

/** 이름 앞부분으로 하나를 찾는다(정확히 같은 이름이 먼저). 없으면 null, 여러 개면 "ambiguous". */
export function findByPrefix<T>(
  items: T[],
  nameOf: (item: T) => string,
  query: string
): T | null | "ambiguous" {
  const q = squash(query)
  if (q.length < 2) return null
  const exact = items.filter((item) => squash(nameOf(item)) === q)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) return "ambiguous"
  const matches = items.filter((item) => squash(nameOf(item)).startsWith(q))
  if (matches.length === 1) return matches[0]
  return matches.length > 1 ? "ambiguous" : null
}

type SourcePick = Pick<ParsedSale, "source_major" | "source_sub" | "source_minor" | "client_id">

/** 출처 줄("카톡,스마일,김재천" / "우영" / "지인,홍길동")이면 출처를, 아니면 null */
function parseSourceLine(
  line: string,
  sources: SaleSourceOption[],
  clients: ClientOption[]
): ParseResult<SourcePick> | null {
  const parts = line.split(/[,，]/).map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return null
  const [head, ...rest] = parts

  const client = findByPrefix(clients, (c) => c.name, head)
  if (client === "ambiguous") {
    return { ok: false, error: `"${head}"(으)로 시작하는 거래처가 여러 곳이에요. 이름을 조금 더 써 주세요.` }
  }
  if (client) {
    return {
      ok: true,
      value: { source_major: "거래처", source_sub: null, source_minor: client.name, client_id: client.id },
    }
  }

  const majors = [...new Set(sources.map((s) => s.major))]
  const major = SOURCE_ALIASES[squash(head)] ?? majors.find((m) => squash(m) === squash(head))
  if (!major) return null

  if (major === "거래처") {
    const picked = rest[0] ? findByPrefix(clients, (c) => c.name, rest[0]) : null
    if (picked === "ambiguous" || !picked) {
      return { ok: false, error: `거래처 "${rest[0] ?? ""}"을(를) 찾지 못했어요. 앱에 등록된 거래처 이름으로 써 주세요.` }
    }
    return {
      ok: true,
      value: { source_major: "거래처", source_sub: null, source_minor: picked.name, client_id: picked.id },
    }
  }

  const subs = sources.filter((s) => s.major === major && s.sub).map((s) => s.sub as string)
  let sub: string | null = null
  if (rest[0]) {
    const found = findByPrefix(subs, (s) => s, rest[0])
    if (found && found !== "ambiguous") {
      sub = found
      rest.shift()
    }
  }
  return {
    ok: true,
    value: { source_major: major, source_sub: sub, source_minor: rest[0] ?? null, client_id: null },
  }
}

/** "세금 주주부린물류", "계산서: 주주부린물류" → 세금계산서 + 사업자 정보. 아니면 null */
export function parseBillingLine(line: string): string | null {
  const m = line.match(/^(?:세금계산서|세금|계산서)[\s,:：，]+(.+)$/)
  return m ? m[1].trim() || null : null
}

function resolveBilling(
  written: string | null,
  source: SourcePick | null,
  clients: ClientOption[]
): string | null {
  if (!written) return source?.client_id ? source.source_minor : null
  const client = findByPrefix(clients, (c) => c.name, written)
  return client && client !== "ambiguous" ? client.name : written
}

/** 첫 줄(종류)을 뺀 나머지 줄로 매출 값을 만든다. */
const LOAD = /^(냉동|냉장|상온|실온)\s*(\d+)?\s*(?:파레트|파렛|plt|p)?\s*(?:[,，\s]\s*(\d+(?:\.\d+)?)\s*(?:톤|t)?)?$/i

/** "냉동3", "냉동 3, 1.3", "냉장 2p 1.5톤" → 물량("냉동3p") + 중량(톤). 이 배차의 화물이지 차종이 아니다. */
export function parseLoadLine(line: string): { note: string; weight: number | null } | null {
  const m = line.trim().match(LOAD)
  if (!m) return null
  const weight = m[3] ? Number(m[3]) : null
  if (weight !== null && !(weight > 0 && weight < 100)) return null
  return { note: `${m[1]}${m[2] ? `${m[2]}p` : ""}`, weight }
}

/** "1.6", "1.6톤", "5톤" → 무게(톤). 단위 없는 정수는 100 미만일 때만(금액과 헷갈리지 않게). */
export function parseWeightLine(line: string): number | null {
  const m = line.replace(/\s/g, "").match(/^(\d+(?:\.\d+)?)(톤|t)?$/i)
  if (!m) return null
  const value = Number(m[1])
  if (!m[2] && Number.isInteger(value) && value >= 100) return null
  return value > 0 && value < 100 ? value : null
}

const SALE_PHONE = /(01\d[-\s]?\d{3,4}[-\s]?\d{4})/

export function parseSaleLines(
  lines: string[],
  ctx: { today: string; sources: SaleSourceOption[]; clients: ClientOption[] }
): ParseResult<ParsedSale> {
  let date: string | null = null
  let amount: number | null = null
  let payment: PaymentMethod | null = null
  let source: SourcePick | null = null
  let billing: string | null = null
  const places: string[] = []
  let cargoNote: string | null = null
  let weight: number | null = null

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // 물량("냉동3", "냉동 3, 1.0")과 무게("1.0", "1.6톤") — "1.0"이 금액 1원으로 읽히지 않게 먼저 본다
    if (cargoNote === null) {
      const load = parseLoadLine(line)
      if (load) {
        cargoNote = load.note
        if (load.weight !== null && weight === null) weight = load.weight
        continue
      }
    }
    if (weight === null && /[.톤t]/i.test(line)) {
      const w = parseWeightLine(line)
      if (w !== null) {
        weight = w
        continue
      }
    }

    const parsedDate: string | null = date === null ? parseDateLine(line, ctx.today) : null
    if (parsedDate) {
      date = parsedDate
      continue
    }

    const billingName = parseBillingLine(line)
    if (billingName) {
      billing = billingName
      payment = "TAX_INVOICE"
      continue
    }

    const money = parseMoneyLine(line)
    if (money) {
      if (money.amount !== null) {
        if (amount !== null) return { ok: false, error: "금액이 두 줄에 있어요. 한 줄만 써 주세요." }
        amount = money.amount
      }
      if (money.payment) payment = money.payment
      continue
    }

    if (source === null) {
      const picked = parseSourceLine(line, ctx.sources, ctx.clients)
      if (picked && !picked.ok) return picked
      if (picked) {
        source = picked.value
        continue
      }
    }

    places.push(line)
  }

  // "아토 이준호"처럼 띄어 쓴 거래처 줄(배차 메시지 모양): 끝 줄부터, 첫 단어가 거래처이고
  // 그 줄을 빼도 상차지·하차지가 남을 때만 거래처로 본다. 뒤 이름은 담당자, 전화번호는 담당자 연락처.
  const notes: string[] = []
  let contactPhone: string | null = null
  if (source === null && places.length > 2) {
    for (let i = places.length - 1; i >= 0; i--) {
      const phone = places[i].match(SALE_PHONE)?.[1] ?? null
      const [first, ...more] = places[i].replace(SALE_PHONE, " ").trim().split(/\s+/)
      if (more.length === 0 && !phone) continue
      const client = findByPrefix(ctx.clients, (c) => c.name, first)
      if (!client || client === "ambiguous") continue
      source = { source_major: "거래처", source_sub: null, source_minor: client.name, client_id: client.id }
      if (more.length > 0) notes.push(more.join(" "))
      contactPhone = phone
      places.splice(i, 1)
      break
    }
  }

  if (amount === null) return { ok: false, error: "금액을 못 찾았어요. 예: 75만" }
  if (amount <= 0 || amount > MAX_AMOUNT) return { ok: false, error: "금액이 너무 크거나 0원이에요." }
  if (places.length < 2) {
    return { ok: false, error: "상차지와 하차지를 한 줄씩 써 주세요. 예:\n피셔\n부산대" }
  }

  return {
    ok: true,
    value: {
      sale_date: date ?? ctx.today,
      origin: places[0],
      destination: places[1],
      supply_amount: amount,
      payment_method: payment ?? "TAX_INVOICE",
      source_major: source?.source_major ?? null,
      source_sub: source?.source_sub ?? null,
      source_minor: source?.source_minor ?? null,
      client_id: source?.client_id ?? null,
      // 앱 매출 폼처럼: 사업자 정보를 안 쓰면 거래처 이름으로, 쓴 이름이 거래처 앞글자면 전체 이름으로
      billing_entity_name: resolveBilling(billing, source, ctx.clients),
      memo: places.slice(2).join(" / ") || null,
      contact_name: notes.join(" ") || null,
      contact_phone: contactPhone,
      cargo_note: cargoNote,
      weight_ton: weight,
    },
  }
}
