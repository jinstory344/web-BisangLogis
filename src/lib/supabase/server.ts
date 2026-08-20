import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase/database.types"

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
