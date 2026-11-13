"use client"

import { LogOut } from "lucide-react"

import { logout } from "@/app/(app)/actions"
import { clearPageCache } from "@/components/layout/service-worker"

/** 설정 화면의 로그아웃. 폰에 저장해 둔 HOME 화면도 함께 지운다. */
export function LogoutButton() {
  return (
    <form action={logout} onSubmit={clearPageCache}>
      <button
        type="submit"
        className="flex h-12 w-full items-center gap-3 px-4 text-[15px] text-red-400 active:bg-muted/60"
      >
        <LogOut className="size-5" />
        로그아웃
      </button>
    </form>
  )
}
