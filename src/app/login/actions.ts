"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type LoginState = {
  error: string | null
  /** 실패했을 때 이메일 칸을 다시 채워 두려고 돌려준다 (폼 제출 뒤 React가 칸을 비우므로) */
  email?: string
}

const INVALID_CREDENTIALS_MESSAGE = "이메일 또는 비밀번호가 올바르지 않습니다"

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  const email = String(formData.get("email") ?? "")

  if (!parsed.success) {
    return { error: INVALID_CREDENTIALS_MESSAGE, email }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { error: INVALID_CREDENTIALS_MESSAGE, email }
  }

  redirect("/")
}
