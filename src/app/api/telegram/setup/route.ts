import { NextResponse } from "next/server"

import { callTelegram, safeEqual, webhookSecret } from "@/lib/telegram/bot"

export const dynamic = "force-dynamic"

const WEBHOOK_URL = "https://www.bisang.co/api/telegram"

/** 봇 웹훅 등록(한 번만). 봇 열쇠를 밖으로 꺼내지 않으려고 서버에서 텔레그램에 직접 알린다. BACKUP_TOKEN으로 지킨다. */
export async function POST(request: Request) {
  const backupToken = process.env.BACKUP_TOKEN
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const given = request.headers.get("authorization") ?? ""
  if (!backupToken || !safeEqual(given, `Bearer ${backupToken}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN이 없습니다" }, { status: 500 })
  }

  const [webhook, me] = await Promise.all([
    callTelegram("setWebhook", {
      url: WEBHOOK_URL,
      secret_token: webhookSecret(botToken),
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    }),
    callTelegram("getMe", {}),
  ])
  const meBody = (await me.json()) as { result?: { username?: string } }
  return NextResponse.json({
    webhook: await webhook.json(),
    bot: meBody.result?.username ?? null,
  })
}
