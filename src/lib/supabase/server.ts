import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase/database.types"
import { retryFetch } from "@/lib/supabase/retry-fetch"

export async function createClient() {
  // 로컬 개발 중 로그인 없이도 데이터를 볼 수 있도록 RLS를 우회하는 admin
  // 클라이언트를 쓴다. NODE_ENV는 `next dev`에서만 "development"이므로
  // 배포 빌드·프로덕션에는 영향이 없다 (middleware.ts의 우회와 짝을 이룬다).
  if (process.env.NODE_ENV === "development") {
    return createAdminClient()
  }

  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // 토큰 갱신 직후 서버 시계 어긋남("JWT issued at future")을 잠시 뒤 다시 시도해 넘긴다.
      global: { fetch: retryFetch },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Component에서 호출된 경우 무시.
            // middleware가 세션 갱신을 담당하므로 안전하다.
          }
        },
      },
    }
  )
}
