import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/lib/supabase/database.types"
import { retryFetch } from "@/lib/supabase/retry-fetch"

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // 토큰 갱신 직후 서버 시계 어긋남("JWT issued at future")을 잠시 뒤 다시 시도해 넘긴다.
    { global: { fetch: retryFetch } }
  )
}
