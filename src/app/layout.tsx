import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ServiceWorkerRegister } from "@/components/layout/service-worker";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** [화면 폭, 화면 높이, 배율] — 최근 아이폰들 (세로) */
const SPLASH_SIZES: [number, number, number][] = [
  [440, 956, 3], [430, 932, 3], [402, 874, 3], [393, 852, 3], [428, 926, 3],
  [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2],
]

export const metadata: Metadata = {
  title: "비상로지스",
  // 아이폰 "홈 화면에 추가" 때 기본 이름 (상태 표시줄 모양은 지금처럼 theme-color를 따른다)
  appleWebApp: {
    title: "비상",
    // 홈 화면 앱을 켤 때 까만 화면 대신 로고 시작 화면 (아이폰 기종별 크기, public/splash)
    startupImage: SPLASH_SIZES.map(([w, h, r]) => ({
      url: `/splash/splash-${w * r}x${h * r}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
    })),
  },
  description: "개인 운송사업자를 위한 배차·매출·지출·세금계산서 통합 관리",
};

/** 휴대폰 상단 상태 표시줄도 앱 바탕색과 같게 */
export const viewport: Viewport = {
  themeColor: "#26272c",
  colorScheme: "dark",
  // 홈 화면에서 앱처럼 열 때 아래 홈 막대 높이(safe-area-inset-bottom)를 알 수 있게 한다.
  // 하단 탭이 그 높이만큼 아래 여백을 둬서 막대가 탭 글씨에 겹치지 않는다.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
