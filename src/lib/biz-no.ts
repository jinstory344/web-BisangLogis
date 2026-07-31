import { z } from "zod"

/**
 * 사업자등록번호 검증 (2.5).
 * 10자리, 하이픈 제거 후 저장(5.1). 국세청 공개 체크섬 알고리즘 사용.
 */

export function normalizeBizNo(input: string): string {
  return input.replace(/\D/g, "")
}

export function isValidBizNoChecksum(digits: string): boolean {
  if (!/^\d{10}$/.test(digits)) {
    return false
  }

  const d = digits.split("").map(Number)
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5]

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += d[i] * weights[i]
  }
  sum += Math.floor((d[8] * 5) / 10)

  const checkDigit = (10 - (sum % 10)) % 10
  return checkDigit === d[9]
}

/** 폼 입력용: 빈 값은 허용(선택 필드), 값이 있으면 10자리 + 체크섬 검증 통과해야 함 */
export const bizNoSchema = z
  .string()
  .transform(normalizeBizNo)
  .refine((v) => v.length === 0 || v.length === 10, {
    message: "사업자등록번호는 10자리여야 합니다",
  })
  .refine((v) => v.length === 0 || isValidBizNoChecksum(v), {
    message: "사업자등록번호 형식이 올바르지 않습니다",
  })

/** 3-2-5 자리 표시용 포맷 (예: 1234567890 -> 123-45-67890) */
export function formatBizNo(digits: string): string {
  const v = normalizeBizNo(digits)
  if (v.length !== 10) return digits
  return `${v.slice(0, 3)}-${v.slice(3, 5)}-${v.slice(5, 10)}`
}
