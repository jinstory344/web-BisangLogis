/**
 * 카드 할부 지출: 총액을 개월 수로 나눠 달마다 한 줄씩 지출로 잡는다.
 * 같은 할부의 줄들은 installment_group_id가 같고, installment_no가 회차(1부터)다.
 * 첫 회차는 고른 지출일자, 다음 회차부터 한 달씩 뒤(그 달에 없는 날이면 그 달 말일).
 * 나누어떨어지지 않는 원 단위 나머지는 첫 회차에 더한다 — 회차 합계가 항상 총액과 같다.
 */

export interface InstallmentPart {
  expense_date: string
  amount: number
  installment_no: number | null
  installment_months: number | null
  installment_group_id: string | null
}

/** "2026-01-31" + 1달 → "2026-02-28" (그 달에 없는 날은 말일로) */
export function addMonthsClamped(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number)
  const index = y * 12 + (m - 1) + months
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const day = Math.min(d, lastDay)
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** 할부로 나눌지 (2개월 이상일 때만; 1개월·없음은 일시불) */
export function isInstallment(months: number | null | undefined): boolean {
  return typeof months === "number" && months >= 2
}

/** 총액이 개월 수보다 작으면 0원 회차가 생겨서 막는다. 괜찮으면 null, 아니면 오류 문장 */
export function checkInstallment(amount: number, months: number | null | undefined): string | null {
  if (!months || !isInstallment(months)) return null
  if (amount < months) return `할부 금액이 너무 작아요 (${months}개월이면 ${months}원 이상)`
  return null
}

/**
 * 지출 한 건을 저장할 줄들로 나눈다. 일시불이면 한 줄 그대로(할부 칸은 null).
 * groupId는 할부일 때 모든 회차에 같은 값으로 붙는다.
 */
export function splitInstallments(
  input: { expense_date: string; amount: number; installment_months?: number | null },
  groupId: string
): InstallmentPart[] {
  const months = input.installment_months ?? null
  if (months === null || !isInstallment(months)) {
    return [
      {
        expense_date: input.expense_date,
        amount: input.amount,
        installment_no: null,
        installment_months: months === 1 ? 1 : null,
        installment_group_id: null,
      },
    ]
  }
  const base = Math.floor(input.amount / months)
  const first = input.amount - base * (months - 1)
  return Array.from({ length: months }, (_, i) => ({
    expense_date: addMonthsClamped(input.expense_date, i),
    amount: i === 0 ? first : base,
    installment_no: i + 1,
    installment_months: months,
    installment_group_id: groupId,
  }))
}

/** 목록에 붙일 회차 표시: "할부 3/6" (할부가 아니면 "") */
export function installmentLabel(no: number | null | undefined, months: number | null | undefined): string {
  if (!isInstallment(months)) return ""
  return no ? `할부 ${no}/${months}` : `${months}개월 할부`
}

/**
 * 할부 묶음의 줄들 → 수정·복사 화면에 보여 줄 값: 첫 회차 날짜와 총액.
 * (한 회차만 보고 고치면 금액이 회차 금액으로 줄어드는 실수를 막는다)
 */
export function summarizeInstallmentGroup(
  rows: readonly { expense_date: string; amount: number; installment_no: number | null }[]
): { expense_date: string; amount: number } | null {
  if (rows.length === 0) return null
  const sorted = [...rows].sort((a, b) => (a.installment_no ?? 0) - (b.installment_no ?? 0))
  return {
    expense_date: sorted[0].expense_date,
    amount: rows.reduce((total, row) => total + row.amount, 0),
  }
}
