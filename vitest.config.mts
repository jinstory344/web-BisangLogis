import { defineConfig } from "vitest/config"

/**
 * tsconfig의 `@/*` 경로 별칭을 vitest에도 동일하게 알려준다.
 * 이게 없으면 `@/lib/...`을 import하는 모듈(예: lib/validations/*)은
 * 테스트에서 모듈 해석에 실패한다. Next.js 빌드는 tsconfig를 직접 읽으므로
 * 이 파일의 영향을 받지 않는다.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
})
