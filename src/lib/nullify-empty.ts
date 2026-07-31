/**
 * 폼에서 빈 문자열로 남은 선택 필드를 DB 저장 전 null로 변환한다.
 * (텍스트 필드는 nullable text 컬럼이므로 빈 문자열 대신 null을 저장한다)
 */
export function nullifyEmptyStrings<T extends Record<string, unknown>>(
  input: T
): { [K in keyof T]: T[K] extends string ? string | null : T[K] } {
  const result = {} as { [K in keyof T]: T[K] extends string ? string | null : T[K] }

  for (const key in input) {
    const value = input[key]
    result[key] = (
      typeof value === "string" && value.trim() === "" ? null : value
    ) as (typeof result)[typeof key]
  }

  return result
}
