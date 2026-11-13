"use client"

import Link from "next/link"
import type { ComponentProps } from "react"

import { withReturnTo } from "@/lib/return-to"

import { useCurrentPath } from "./use-current-path"

/**
 * 수정 화면으로 가는 링크. 지금 화면 주소를 ?returnTo= 로 붙여서, 저장하면 이 화면으로 돌아오게 한다.
 * (Button asChild 안에서도 쓸 수 있게 Link 속성을 그대로 넘긴다)
 */
export function ReturnToLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const current = useCurrentPath()
  return <Link href={withReturnTo(href, current)} {...props} />
}
