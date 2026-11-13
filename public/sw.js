/*
 * 비상로지스 서비스 워커 — 홈 화면 앱을 열 때 바로 뜨게 한다.
 *
 * - HOME("/", 주소 뒤 조건 없음): 서버가 0.3초 안에 답하면 새 화면을, 늦으면(서버가 잠에서 깨는 중 등)
 *   폰에 저장해 둔 마지막 화면을 먼저 보여 준다. 새 화면은 받는 대로 저장해 두고,
 *   옛 화면으로 열렸으면 RefreshIfStale(앱 쪽)이 최신 숫자로 다시 그린다.
 *   (빠른 답을 먼저 쓰므로 배포 직후 새로고침이 옛 화면에 갇히지 않는다)
 * - /_next/static/*: 이름에 버전이 들어간 파일이라 한 번 받으면 폰에서 바로 쓴다(배포 뒤에도 옛 화면이 깨지지 않게).
 * - 그 밖의 요청은 건드리지 않는다(저장·수정은 항상 서버로).
 * 로그아웃하면 앱 쪽에서 저장해 둔 화면을 지운다(clearPageCache).
 */
const PAGE_CACHE = "bisang-pages-v1"
const ASSET_CACHE = "bisang-assets-v1"
/** 서버가 이 안에 답하면 저장해 둔 화면 대신 새 화면을 쓴다 */
const FAST_ENOUGH_MS = 300

self.addEventListener("install", () => self.skipWaiting())

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PAGE_CACHE, ASSET_CACHE]
      for (const key of await caches.keys()) {
        if (!keep.includes(key)) await caches.delete(key)
      }
      await self.clients.claim()
    })()
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE)
        const hit = await cache.match(request)
        if (hit) return hit
        const response = await fetch(request)
        if (response.ok) cache.put(request, response.clone())
        return response
      })()
    )
    return
  }

  if (request.mode === "navigate" && url.pathname === "/" && url.search === "") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGE_CACHE)
        const cached = await cache.match("/")
        const fresh = fetch(request)
          .then((response) => {
            // 로그인 화면으로 넘어간 응답(로그아웃 상태)은 저장하지 않는다.
            if (response.ok && !response.redirected && response.type === "basic") {
              event.waitUntil(cache.put("/", response.clone()))
            }
            return response
          })
          .catch(() => cached)
        if (!cached) return fresh
        event.waitUntil(fresh.then(() => undefined))
        const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), FAST_ENOUGH_MS))
        return Promise.race([fresh, timeout])
      })()
    )
  }
})
