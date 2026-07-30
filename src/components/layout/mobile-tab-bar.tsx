"use client"

import { LogOut, MoreHorizontal } from "lucide-react"
import { useState } from "react"

import { logout } from "@/app/(app)/actions"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { primaryNavItems, secondaryNavItems } from "@/lib/constants/nav"

import { NavLink } from "./nav-link"

export function MobileTabBar({ userEmail }: { userEmail: string | null }) {
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background md:hidden">
      {primaryNavItems.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px]"
          iconClassName="size-5"
        />
      ))}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] text-muted-foreground"
          >
            <MoreHorizontal className="size-5" />
            <span>더보기</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="pb-8">
          <SheetHeader>
            <SheetTitle>더보기</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 px-4">
            {secondaryNavItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
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
