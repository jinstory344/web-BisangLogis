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
 */

export type ExpenseCategoryOption = { major: string; minor: string }

export type ParsedExpense = {
  expense_date: string
  category_major: string
  category_minor: string
  amount: number
  payment_method: ExpensePaymentMethod
  memo: string | null
}

const PAYMENT_WORDS: Record<string, ExpensePaymentMethod> = {
  카드: "CARD",
  이체: "TRANSFER",
  계좌이체: "TRANSFER",
  현금: "CASH",
}

function parseMoneyLine(
  line: string
): { amount: number | null; payment: ExpensePaymentMethod | null } | null {
  let amount: number | null = null
  let payment: ExpensePaymentMethod | null = null
  for (const token of line.split(/\s+/)) {
    if (PAYMENT_WORDS[token]) {
      payment = PAYMENT_WORDS[token]
      continue
    }
    const value = parseAmountToken(token)
    if (value === null || amount !== null) return null
    amount = value
  }
  return amount === null && payment === null ? null : { amount, payment }
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
  ctx: { today: string; categories: ExpenseCategoryOption[] }
): ParseResult<ParsedExpense> {
  let date: string | null = null
  let amount: number | null = null
  let payment: ExpensePaymentMethod | null = null
  let category: ExpenseCategoryOption | null = null
  const rest: string[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const parsedDate: string | null = date === null ? parseDateLine(line, ctx.today) : null
    if (parsedDate) {
      date = parsedDate
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
      memo: rest.length > 0 ? rest.join(" / ") : null,
    },
  }
}
