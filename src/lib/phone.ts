/** 전화번호 표시 포맷 — 대부분 휴대폰(11자리)이므로 000-0000-0000(3-4-4)으로 표기한다. */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "-"

  const digits = phone.replace(/\D/g, "")
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}
