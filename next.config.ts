import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 한 번 본 화면은 30초 동안 휴대폰에 두었다가, 다시 누르면 서버를 기다리지 않고 바로 보여 준다.
    // 저장·삭제 등 서버 액션이 revalidatePath를 부르면 이 보관분은 바로 버려져 최신 내용으로 다시 받는다.
    staleTimes: { dynamic: 30 },
  },
  // 서비스 워커 파일은 늘 새로 확인해서 고친 내용이 바로 퍼지게 한다.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ]
  },
};

export default nextConfig;
