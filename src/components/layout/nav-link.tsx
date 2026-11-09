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
}: {
  item: NavItem
  className?: string
  iconClassName?: string
  labelClassName?: string
  /** 링크를 눌렀을 때 (시트 안 메뉴에서 시트를 닫는 용도) */
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const isActive = isNavItemActive(item, pathname)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
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
