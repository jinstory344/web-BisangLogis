import { matchCardName } from "@/lib/constants/expense-cards"
import { isFuelCategory } from "@/lib/fuel"
import type { ExpensePaymentMethod } from "@/lib/supabase/database.types"
import {
  findByPrefix,
  MAX_AMOUNT,
  parseAmountToken,
  parseDateLine,
  squash,
  type ParseResult,
} from "@/lib/telegram/parse-sale"

/**
 * 텔레그램 지출 메시지: 금액·날짜·결제방법(카드/이체/현금)·분류(소분류 앞글자, 또는 "차량,주유비")는 아무 줄에나,
 * 나머지 줄은 비고. 결제방법을 안 쓰면 카드.
 * 할부는 금액 줄에 "6개월" 또는 "할부6"(2~12개월, 카드만) — 달마다 나눠 지출로 잡힌다.
 * 카드 이름(앱의 카드 목록, 띄어쓰기 무시)은 금액 줄 안이나 따로 한 줄로 — 결제는 카드로 잡힌다.
 * 리터는 금액 뒤에 쉼표 + 숫자("8만,50") 또는 "50L" — 주유비·요소수일 때만 저장한다.
 */

export type ExpenseCategoryOption = { major: string; minor: string }

export type ParsedExpense = {
  expense_date: string
  category_major: string
  category_minor: string
  amount: number
  payment_method: ExpensePaymentMethod
  /** 2~12면 할부, 없으면 일시불 */
  installment_months: number | null
  /** 카드 목록에서 찾은 카드 이름 (없으면 null) */
  card_name: string | null
  /** 리터 (주유비·요소수일 때만, 없으면 null) */
  liters: number | null
  memo: string | null
}

/**
 * 금액 줄에서 "금액,리터"의 리터를 떼어 낸다 ("8만,50" "8만, 50L" "80000,50.5").
 * "80,000"처럼 천 단위 쉼표로 보이는 것(쉼표 바로 뒤 숫자 세 자리, 띄어쓰기·L 없음, 앞이 숫자)은 그대로 둔다.
 */
export function splitLiters(line: string): { line: string; liters: number | null } {
  const match = line.match(/(\d(?:만|천)?원?)\s*[,，](\s*)(\d{1,5}(?:\.\d)?)\s*(L|l|리터)?(?=\s|$)/)
  if (!match) return { line, liters: null }
  const [all, left, space, num, unit] = match
  if (!space && !unit && /^\d{3}$/.test(num) && /\d$/.test(left)) return { line, liters: null }
  const liters = Number(num)
  if (!(liters > 0)) return { line, liters: null }
  return { line: line.replace(all, left), liters }
}

/** "50L" "50.5리터" → 리터, 아니면 null */
function parseLiterToken(token: string): number | null {
  const match = token.match(/^(\d{1,5}(?:\.\d)?)(?:L|l|리터)$/)
  return match && Number(match[1]) > 0 ? Number(match[1]) : null
}

/** "6개월", "6개월할부", "할부6", "할부 6개월"의 6 (2~12만). 아니면 null */
export function parseInstallmentToken(token: string): number | null {
  const match = token.match(/^(?:할부)?(\d{1,2})(?:개월)?(?:할부)?$/)
  if (!match || !/개월|할부/.test(token)) return null
  const months = Number(match[1])
  return months >= 2 && months <= 12 ? months : null
}

const PAYMENT_WORDS: Record<string, ExpensePaymentMethod> = {
  카드: "CARD",
  이체: "TRANSFER",
  계좌이체: "TRANSFER",
  현금: "CASH",
}

function parseMoneyLine(
  line: string,
  cards: readonly string[]
): {
  amount: number | null
  payment: ExpensePaymentMethod | null
  months: number | null
  card: string | null
  liters: number | null
} | null {
  let amount: number | null = null
  let payment: ExpensePaymentMethod | null = null
  let months: number | null = null
  let card: string | null = null
  const split = splitLiters(line)
  let liters = split.liters
  // "할부 6개월"처럼 띄어 써도 한 덩어리로
  for (const token of split.line.replace(/할부\s+(?=\d)/g, "할부").split(/\s+/)) {
    const literToken = parseLiterToken(token)
    if (literToken !== null) {
      liters = literToken
      continue
    }
    if (PAYMENT_WORDS[token]) {
      payment = PAYMENT_WORDS[token]
      continue
    }
    const cardName = matchCardName(cards, token)
    if (cardName) {
      card = cardName
      continue
    }
    const installment = parseInstallmentToken(token)
    if (installment !== null) {
      months = installment
      continue
    }
    const value = parseAmountToken(token)
    if (value === null || amount !== null) return null
    amount = value
  }
  // 카드 이름 하나만 있는 줄은 아래에서 따로 본다 (분류 이름과 겹칠 수 있어 금액 줄로 보지 않는다)
  return amount === null && payment === null && months === null
    ? null
    : { amount, payment, months, card, liters }
}

function parseCategoryLine(
  line: string,
  categories: ExpenseCategoryOption[]
): ParseResult<ExpenseCategoryOption> | null {
  const parts = line.split(/[,，>›]/).map((p) => p.trim()).filter(Boolean)
  let pool = categories
  let query = parts[0] ?? ""
  if (parts.length >= 2) {
    const inMajor = categories.filter((c) => squash(c.major) === squash(parts[0]))
    if (inMajor.length === 0) return null
    pool = inMajor
    query = parts[1]
  }
  const found = findByPrefix(pool, (c) => c.minor, query)
  if (found === "ambiguous") {
    const names = pool.filter((c) => squash(c.minor).startsWith(squash(query))).map((c) => c.minor)
    return { ok: false, error: `"${query}"에 맞는 분류가 여러 개예요: ${names.join(", ")}` }
  }
  return found ? { ok: true, value: found } : null
}

export function parseExpenseLines(
  lines: string[],
  ctx: { today: string; categories: ExpenseCategoryOption[]; cards?: readonly string[] }
): ParseResult<ParsedExpense> {
  let date: string | null = null
  let amount: number | null = null
  let payment: ExpensePaymentMethod | null = null
  let months: number | null = null
  let category: ExpenseCategoryOption | null = null
  let card: string | null = null
  let liters: number | null = null
  const cards = ctx.cards ?? []
  const rest: string[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const parsedDate: string | null = date === null ? parseDateLine(line, ctx.today) : null
    if (parsedDate) {
      date = parsedDate
      continue
    }

    const money = parseMoneyLine(line, cards)
    if (money) {
      if (money.amount !== null) {
        if (amount !== null) return { ok: false, error: "금액이 두 줄에 있어요. 한 줄만 써 주세요." }
        amount = money.amount
      }
      if (money.payment) payment = money.payment
      if (money.months) months = money.months
      if (money.card) card = money.card
      if (money.liters !== null) liters = money.liters
      continue
    }

    const lineCard = card === null ? matchCardName(cards, line) : null
    if (lineCard) {
      card = lineCard
      continue
    }

    if (category === null) {
      const picked = parseCategoryLine(line, ctx.categories)
      if (picked && !picked.ok) return picked
      if (picked) {
        category = picked.value
        continue
      }
    }

    rest.push(line)
  }

  if (amount === null) return { ok: false, error: "금액을 못 찾았어요. 예: 8만" }
  if (amount <= 0 || amount > MAX_AMOUNT) return { ok: false, error: "금액이 너무 크거나 0원이에요." }
  if (months !== null && payment !== null && payment !== "CARD") {
    return { ok: false, error: "할부는 카드일 때만 돼요." }
  }
  if (card !== null && payment !== null && payment !== "CARD") {
    return { ok: false, error: "카드 이름은 결제가 카드일 때만 써 주세요." }
  }
  if (months !== null && amount < months) {
    return { ok: false, error: `할부 금액이 너무 작아요 (${months}개월이면 ${months}원 이상)` }
  }
  if (!category) {
    return { ok: false, error: "분류를 못 찾았어요. 앱의 지출 소분류 이름으로 써 주세요. 예: 주유" }
  }

  return {
    ok: true,
    value: {
      expense_date: date ?? ctx.today,
      category_major: category.major,
      category_minor: category.minor,
      amount,
      payment_method: payment ?? "CARD",
      installment_months: months,
      card_name: card,
      liters: isFuelCategory(category.major, category.minor) ? liters : null,
      memo: rest.length > 0 ? rest.join(" / ") : null,
    },
  }
}
