"use client"

import { LogOut, MoreHorizontal } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import { logout } from "@/app/(app)/actions"
import { clearPageCache } from "@/components/layout/service-worker"
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
import { getTodayInSeoul } from "@/lib/date"

import { isNavItemActive, NavLink } from "./nav-link"

/** 지금 열린 탭은 배경 대신 아이콘·글자를 빨간색으로 (가계부 앱 방식, 탭 밑줄과 같은 red-400) */
const TAB_CLASS_NAME =
  "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] leading-4 data-[active=true]:bg-transparent data-[active=true]:text-red-400"

/**
 * 모바일 하단 탭: [오늘 날짜(비상)] [배차] [통계] [더보기] (가계부 앱 방식).
 * 매출·지출 목록과 나머지 메뉴는 "더보기" 시트에 있고, 등록은 오른쪽 아래 떠 있는 ＋ 버튼으로 한다.
 * 데스크톱(md 이상)은 사이드바를 쓴다.
 * 탭 높이 56px + 아이폰 아래 홈 막대 자리(safe-area-inset-bottom)만큼 아래 여백.
 * 이 높이는 main의 아래 여백, 폼 저장 바·떠 있는 버튼의 위치와 맞춘 값이다(모두 같은 calc).
 */
export function MobileTabBar({ userEmail }: { userEmail: string | null }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const pathname = usePathname()
  // 누른 탭에 바로 불을 옮겨, 새 화면이 도착하기 전에도 눌렸다는 걸 알 수 있게 한다 (도착하면 경로 기준으로 돌아감).
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  useEffect(() => {
    setPendingHref(null)
  }, [pathname])
  const isMoreActive = secondaryNavItems.some((item) =>
    isNavItemActive(item, pathname)
  )

  // 홈(비상) 탭은 이름 대신 오늘 날짜(서울 기준, 예: "11.12.")를 보여 준다 (가계부 앱 방식).
  const today = getTodayInSeoul()
  const todayLabel = `${Number(today.slice(5, 7))}.${Number(today.slice(8, 10))}.`

  const renderTab = (item: (typeof primaryNavItems)[number]) => (
    <NavLink
      key={item.href}
      item={item.href === "/" ? { ...item, label: todayLabel } : item}
      className={TAB_CLASS_NAME}
      iconClassName="size-5"
      labelClassName={item.href === "/" ? "tabular-nums" : undefined}
      active={pendingHref ? pendingHref === item.href : undefined}
      onNavigate={() => {
        if (!isNavItemActive(item, pathname)) setPendingHref(item.href)
      }}
    />
  )

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(3.5rem+env(safe-area-inset-bottom))] border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      {primaryNavItems.map(renderTab)}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            data-active={pendingHref ? false : isMoreActive}
            className={`${TAB_CLASS_NAME} text-muted-foreground`}
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
            <form action={logout} onSubmit={clearPageCache}>
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
