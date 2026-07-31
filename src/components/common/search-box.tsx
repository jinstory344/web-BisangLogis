"use client"

import { Search } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { Input } from "@/components/ui/input"

export function SearchBox({
  defaultValue,
  placeholder,
}: {
  defaultValue: string
  placeholder: string
}) {
  const [value, setValue] = useState(defaultValue)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set("q", value)
      } else {
        params.delete("q")
      }
      router.replace(`${pathname}?${params.toString()}`)
    }, 300)

    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className="relative max-w-sm">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-8"
      />
    </div>
  )
}
