"use client"

import { useActionState, useRef, useState } from "react"

import { login, type LoginState } from "./actions"
import { UnlockSlider } from "./unlock-slider"

const initialState: LoginState = { error: null }

/**
 * 테두리 없는 밑줄 입력칸 (아이콘 없이). 비어 있을 때만 칸 안에 흐린 이름이 보이고,
 * 누르면 이름이 사라진다. 글자는 16px — 아이폰이 입력할 때 화면을 확대하지 않게.
 */
const underlineInput =
  "w-full border-0 border-b border-white/20 bg-transparent px-0.5 pt-2 pb-3 text-[17px] text-white outline-none transition-colors placeholder:text-white/35 focus:border-b-2 focus:border-blue-500 focus:pb-[11px] focus:placeholder:text-transparent"

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const [showPassword, setShowPassword] = useState(false)

  function submit(): boolean {
    const form = formRef.current
    if (!form) return false
    if (!form.checkValidity()) {
      form.reportValidity()
      return false
    }
    form.requestSubmit()
    return true
  }

  return (
    <form ref={formRef} action={formAction} className="mt-14 flex flex-col">
      <label htmlFor="email" className="sr-only">
        이메일
      </label>
      <input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        placeholder="이메일"
        defaultValue={state.email}
        required
        className={underlineInput}
      />

      <label htmlFor="password" className="sr-only">
        비밀번호
      </label>
      <div className="relative mt-7">
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="비밀번호"
          required
          enterKeyHint="go"
          className={`${underlineInput} pr-14`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute top-0 right-0 flex h-full items-center px-1 text-sm text-white/50 hover:text-white/80"
          aria-pressed={showPassword}
        >
          {showPassword ? "숨기기" : "보기"}
        </button>
      </div>

      <p className="mt-4 min-h-5 text-sm text-red-400" role="alert">
        {state.error}
      </p>

      {/* 키보드의 '이동(Go)'·Enter로도 제출되게 하는 보이지 않는 기본 버튼 */}
      <button type="submit" tabIndex={-1} aria-hidden className="sr-only">
        로그인
      </button>

      <div className="mt-6">
        <UnlockSlider onUnlock={submit} pending={isPending} />
      </div>
    </form>
  )
}
