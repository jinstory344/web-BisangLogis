"use client"

import { LogOut, MoreHorizontal } from "lucide-react"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { logout } from "@/app/(app)/actions"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { primaryNavItems, secondaryNavItems } from "@/lib/constants/nav"

import { isNavItemActive, NavLink } from "./nav-link"

const TAB_CLASS_NAME =
  "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px]"

/**
 * 모바일 하단 탭: [장부] [배차] [통계] [더보기] (가계부 앱 방식).
 * 매출·지출 목록과 나머지 메뉴는 "더보기" 시트에 있고, 등록은 오른쪽 아래 떠 있는 ＋ 버튼으로 한다.
 * 데스크톱(md 이상)은 사이드바를 쓴다.
 * 높이 h-16(64px)은 main의 pb-16, 폼 저장 바의 bottom-16과 맞춘 값이다.
 */
export function MobileTabBar({ userEmail }: { userEmail: string | null }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const pathname = usePathname()
  const isMoreActive = secondaryNavItems.some((item) =>
    isNavItemActive(item, pathname)
  )

  const renderTab = (item: (typeof primaryNavItems)[number]) => (
    <NavLink
      key={item.href}
      item={item}
      className={TAB_CLASS_NAME}
      iconClassName="size-5"
    />
  )

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t bg-background md:hidden">
      {primaryNavItems.map(renderTab)}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            data-active={isMoreActive}
            className={`${TAB_CLASS_NAME} text-muted-foreground data-[active=true]:bg-muted data-[active=true]:text-foreground`}
          >
            <MoreHorizontal className="size-5" />
            <span>더보기</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="pb-8">
          <SheetHeader>
            <SheetTitle>더보기</SheetTitle>
            <SheetDescription className="sr-only">
              매출·지출 목록과 기타 메뉴
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 px-4">
            {secondaryNavItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                onNavigate={() => setMoreOpen(false)}
                className="flex flex-col items-center justify-center gap-1 rounded-md border py-4 text-xs"
                iconClassName="size-5"
                labelClassName="text-center"
              />
            ))}
          </div>
          <div className="mt-2 flex flex-col gap-2 px-4">
            {userEmail ? (
              <p className="truncate text-xs text-muted-foreground">
                {userEmail}
              </p>
            ) : null}
            <form action={logout}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
              >
                <LogOut className="size-4" />
                로그아웃
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  )
}
