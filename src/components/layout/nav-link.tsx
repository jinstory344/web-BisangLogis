"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import type { NavItem } from "@/lib/constants/nav"

/** NavLink와 같은 규칙으로 현재 경로가 메뉴 항목에 해당하는지 판단한다. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
}

export function NavLink({
  item,
  className,
  iconClassName,
  labelClassName,
  onNavigate,
  active,
}: {
  item: NavItem
  className?: string
  iconClassName?: string
  labelClassName?: string
  /** 링크를 눌렀을 때 (시트 안 메뉴에서 시트를 닫는 용도) */
  onNavigate?: () => void
  /** 지정하면 경로 대신 이 값으로 선택 표시 (하단 탭이 누르는 즉시 불을 옮길 때) */
  active?: boolean
}) {
  const pathname = usePathname()
  const isActive = active ?? isNavItemActive(item, pathname)
  const Icon = item.icon

  // 아직 화면이 없는 메뉴: 흐리게 보이고 누를 수 없다
  if (item.soon) {
    return (
      <span
        aria-disabled
        className={cn("text-muted-foreground/50", className)}
      >
        <Icon className={iconClassName} />
        <span className={labelClassName}>{item.label}</span>
        <span className="ml-auto text-[11px] text-muted-foreground/60">준비 중</span>
      </span>
    )
  }

  return (
    <Link
      href={item.href}
      // 하단 탭·사이드바 메뉴는 항상 보이므로 화면 전체를 미리 받아 두어 누르면 바로 뜨게 한다.
      prefetch
      onClick={onNavigate}
      data-active={isActive}
      className={cn(
        "text-muted-foreground data-[active=true]:text-foreground data-[active=true]:bg-muted",
        className
      )}
    >
      <Icon className={iconClassName} />
      <span className={labelClassName}>{item.label}</span>
    </Link>
  )
}
