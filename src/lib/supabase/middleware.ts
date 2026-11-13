import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// /api/backup·/api/telegram은 로그인 쿠키 대신 자체 비밀 토큰으로 지킨다(구글 시트·텔레그램이 부른다).
const PUBLIC_PATHS = ["/login", "/api/backup", "/api/telegram"]

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

export async function updateSession(request: NextRequest) {
  // 로컬 개발 중 매번 로그인하지 않도록 인증 가드를 건너뛴다.
  // NODE_ENV는 `next dev`에서만 "development"이므로 배포 빌드에는 영향이 없다.
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getClaims는 로그인 토큰을 이 서버에서 직접 검증한다(비대칭 서명 키, 공개키는 캐시).
  // getUser처럼 매 요청 Supabase 인증 서버(뭄바이)까지 왕복하지 않아 페이지가 빨라진다.
  // 토큰이 곧 만료되면 먼저 갱신하고 새 쿠키를 응답에 실어 준다.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims ?? null

  const { pathname } = request.nextUrl

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.searchParams.set("redirectedFrom", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = "/"
    return NextResponse.redirect(homeUrl)
  }

  return supabaseResponse
}
