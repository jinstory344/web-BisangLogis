/**
 * 전화번호 표시 포맷 — 하이픈 없이 저장된 번호도 하이픈을 넣어 보여 준다.
 * 휴대폰(11자리)은 000-0000-0000, 10자리 지역번호는 000-000-0000, 서울(02)은 02-000-0000 /
 * 02-0000-0000, 대표번호(1588 등 8자리)는 0000-0000으로 표기한다. 그 밖의 모양은 입력 그대로 둔다.
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "-"

  // 숫자·공백·하이픈·점·괄호만 있는 번호만 다시 끊는다. "(사무실)" 같은 글자나 "+82"가 섞여 있으면
  // 숫자만 남기다 메모가 사라지지 않도록 입력 그대로 보여 준다.
  if (/[^\d\s\-.()]/.test(phone)) return phone

  const digits = phone.replace(/\D/g, "")

  if (digits.startsWith("02") && (digits.length === 9 || digits.length === 10)) {
    return `02-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 8 && /^1[568]/.test(digits)) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`
  }
  return phone
}
