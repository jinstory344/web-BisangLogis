import { NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

/**
 * 깨우기 핑: Supabase pg_cron이 5분마다 부른다.
 * 서버(함수)를 깨워 두어 앱 첫 화면이 느려지지 않게 하고, DB도 한 번 읽어 무료 플랜 자동 정지(7일 미사용)를 막는다.
 * 아무 데이터도 돌려주지 않는다.
 */
export async function GET() {
  const { error } = await createAdminClient()
    .from("sale_sources")
    .select("id", { head: true, count: "exact" })
    .limit(1)
  return NextResponse.json(
    { ok: !error },
    { status: error ? 500 : 200, headers: { "Cache-Control": "no-store" } }
  )
}
