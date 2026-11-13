import { describe, expect, it, vi } from "vitest"

import { createRetryFetch, isJwtIssuedAtFutureBody } from "./retry-fetch"

const futureBody = JSON.stringify({
  code: "PGRST303",
  details: null,
  hint: null,
  message: "JWT issued at future",
})

function res(status: number, body: string) {
  return new Response(body, { status })
}

describe("isJwtIssuedAtFutureBody", () => {
  it("PGRST303 본문을 알아본다", () => {
    expect(isJwtIssuedAtFutureBody(futureBody)).toBe(true)
    expect(isJwtIssuedAtFutureBody('{"message":"JWT expired"}')).toBe(false)
  })
})

describe("createRetryFetch", () => {
  const noSleep = () => Promise.resolve()

  it("시계 어긋남 401이면 다시 보내고 성공 응답을 돌려준다", async () => {
    const base = vi
      .fn()
      .mockResolvedValueOnce(res(401, futureBody))
      .mockResolvedValueOnce(res(200, "[]"))
    const f = createRetryFetch(base, [1, 1, 1], noSleep)
    const out = await f("https://x/rest/v1/sales", { method: "GET" })
    expect(out.status).toBe(200)
    expect(base).toHaveBeenCalledTimes(2)
  })

  it("다른 401(만료 등)은 다시 보내지 않는다", async () => {
    const base = vi.fn().mockResolvedValue(res(401, '{"message":"JWT expired"}'))
    const f = createRetryFetch(base, [1, 1, 1], noSleep)
    const out = await f("https://x")
    expect(out.status).toBe(401)
    expect(base).toHaveBeenCalledTimes(1)
  })

  it("정상 응답은 그대로 한 번만 보낸다", async () => {
    const base = vi.fn().mockResolvedValue(res(200, "ok"))
    const f = createRetryFetch(base, [1, 1, 1], noSleep)
    await f("https://x")
    expect(base).toHaveBeenCalledTimes(1)
  })

  it("계속 실패하면 정해진 횟수만 다시 보내고 마지막 응답을 돌려준다", async () => {
    const base = vi.fn().mockImplementation(() => Promise.resolve(res(401, futureBody)))
    const f = createRetryFetch(base, [1, 1, 1], noSleep)
    const out = await f("https://x")
    expect(out.status).toBe(401)
    expect(base).toHaveBeenCalledTimes(4)
  })
})
