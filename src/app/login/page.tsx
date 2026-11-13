import type { Metadata } from "next"
import Image from "next/image"

import logo from "../../../public/brand/logo-white.png"

import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "로그인 · 비상로지스",
}

/**
 * 로그인: 어두운 배경에 은은한 파란 빛과 아주 흐린 큰 '비상' 로고(가끔 빛이 스쳐 지나감),
 * 왼쪽 위에 흰 로고(불투명도 65%), 아래에 밑줄 입력칸과 밀어서 여는 Unlock 버튼.
 */
export default function LoginPage() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-[#1d1e22] text-white">
      {/* 배경: 파란 빛 + 흐린 큰 로고 + 로고 위를 지나가는 빛 */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-24 size-[36rem] rounded-full bg-[radial-gradient(circle,rgb(44_92_170/0.3)_0%,rgb(44_92_170/0)_65%)]" />
        <div className="absolute -left-12 top-36 w-[34rem] max-w-none -rotate-[8deg]">
          <Image src={logo} alt="" priority className="w-full opacity-[0.025]" />
          <div className="login-shine absolute inset-0" />
        </div>
      </div>

      <div className="relative mx-auto flex min-h-svh w-full max-w-sm flex-col px-7 pt-[max(6rem,18svh)] pb-10">
        <Image
          src={logo}
          alt="비상로지스"
          priority
          className="w-[7.5rem] opacity-65"
        />
        <LoginForm />
      </div>
    </div>
  )
}
