"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import type { NavItem } from "@/lib/constants/nav"

export function NavLink({
  item,
  className,
  iconClassName,
  labelClassName,
}: {
  item: NavItem
  className?: string
  iconClassName?: string
  labelClassName?: string
}) {
  const pathname = usePathname()
  const isActive =
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
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
