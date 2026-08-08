"use client"

import { LogOut } from "lucide-react"
import { Fragment } from "react"

import { logout } from "@/app/(app)/actions"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { sidebarNavGroups } from "@/lib/constants/nav"

import { NavLink } from "./nav-link"

export function Sidebar({ userEmail }: { userEmail: string | null }) {
  return (
    <aside className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:border-r md:bg-sidebar">
      <div className="flex h-14 items-center px-4">
        <span className="text-lg font-semibold">비상로지스</span>
      </div>
      <Separator />
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {sidebarNavGroups.map((group, index) => (
          <Fragment key={index}>
            {index > 0 ? <Separator className="my-1" /> : null}
            {group.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
                iconClassName="size-4"
              />
            ))}
          </Fragment>
        ))}
      </nav>
      <Separator />
      <div className="flex flex-col gap-2 p-3">
        {userEmail ? (
          <p className="truncate px-1 text-xs text-muted-foreground">
            {userEmail}
          </p>
        ) : null}
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
          >
            <LogOut className="size-4" />
            로그아웃
          </Button>
        </form>
      </div>
    </aside>
  )
}
