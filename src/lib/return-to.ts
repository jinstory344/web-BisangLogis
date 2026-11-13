/**
 * 수정 화면을 연 화면으로 저장 뒤 돌아가기 위한 "돌아갈 주소" 다루기.
 * 수정 링크에 ?returnTo=/지금/화면?쿼리 를 붙이고, 서버 액션이 저장 뒤 그 주소로 보낸다.
 * 바깥 사이트로 보내는 주소(//evil.com, https://...)는 받지 않는다.
 */

const MAX_RETURN_PATH_LENGTH = 500

/** 이 앱 안의 경로("/"로 시작)만 돌려주고, 아니면 null */
export function safeReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  if (raw.length === 0 || raw.length > MAX_RETURN_PATH_LENGTH) return null
  if (!raw.startsWith("/")) return null
  // "//host" 나 "/\host" 는 브라우저가 다른 사이트로 해석한다
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null
  // 제어 문자(줄바꿈 등) 금지
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null
  return raw
}

/** 수정 화면 주소에 돌아갈 주소를 붙인다. 돌아갈 주소가 안전하지 않으면 그대로 둔다. */
export function withReturnTo(href: string, returnTo: string | null | undefined): string {
  const safe = safeReturnPath(returnTo)
  if (!safe) return href
  return `${href}${href.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(safe)}`
}
