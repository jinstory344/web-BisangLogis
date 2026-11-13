import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "비상로지스",
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
      </body>
    </html>
  );
}
