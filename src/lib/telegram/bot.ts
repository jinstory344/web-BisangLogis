import "server-only"

import { createHash, timingSafeEqual } from "node:crypto"

/** 봇 열쇠(TELEGRAM_BOT_TOKEN)에서 웹훅 확인용 비밀값을 만든다 — 환경변수를 하나 덜 쓰려고. */
export function webhookSecret(botToken: string): string {
  return createHash("sha256").update(`bisang-webhook:${botToken}`).digest("hex")
}

export function safeEqual(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** 허락된 대화방 번호(TELEGRAM_CHAT_ID, 쉼표로 여러 개) */
export function allowedChatIds(): string[] {
  return (process.env.TELEGRAM_CHAT_ID ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function callTelegram(
  method: string,
  body: Record<string, unknown>
): Promise<Response> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN이 없습니다")
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) console.error("telegram", method, res.status, await res.clone().text())
  return res
}
