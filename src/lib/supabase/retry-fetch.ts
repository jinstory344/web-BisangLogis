/**
 * Supabase 요청용 fetch: "JWT issued at future"(PostgREST PGRST303)일 때 잠시 기다렸다가 다시 보낸다.
 *
 * 로그인 토큰이 만료돼 미들웨어가 새 토큰을 받으면, 그 토큰의 발급 시각(iat)은 인증 서버 시계 기준이다.
 * 바로 이어지는 DB 조회를 받는 PostgREST 서버 시계가 1~2초 늦으면 "미래에 발급된 토큰"으로 보고 거절한다.
 * 이 거절은 요청을 실행하기 전 단계라 다시 보내도 안전하고, 1~2초 뒤에는 통과한다.
 */

const RETRY_DELAYS_MS = [1000, 1500, 2500]

export function isJwtIssuedAtFutureBody(body: string): boolean {
  return body.includes("PGRST303") || body.includes("JWT issued at future")
}

type FetchLike = typeof fetch

export function createRetryFetch(
  baseFetch: FetchLike = fetch,
  delays: readonly number[] = RETRY_DELAYS_MS,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms))
): FetchLike {
  return async (input, init) => {
    let response = await baseFetch(input, init)

    for (const delay of delays) {
      if (response.status !== 401) return response
      const body = await response.clone().text()
      if (!isJwtIssuedAtFutureBody(body)) return response
      await sleep(delay)
      response = await baseFetch(input, init)
    }

    return response
  }
}

export const retryFetch = createRetryFetch()
