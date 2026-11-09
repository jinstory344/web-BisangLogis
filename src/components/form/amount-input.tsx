"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type ComponentProps,
  type Ref,
} from "react"

import { Input } from "@/components/ui/input"
import {
  applyAmountInputEdit,
  formatAmountInput,
  type AmountEditRange,
} from "@/lib/money"
import { cn } from "@/lib/utils"

type NativeInputProps = Omit<
  ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "type" | "inputMode" | "ref"
>

type AmountInputProps = NativeInputProps & {
  ref?: Ref<HTMLInputElement>
} & (
    | {
        /**
         * 선택 입력 금액(운임 등): 빈칸은 null — 0과 "미입력"을 구분한다.
         * undefined는 절대 쓰지 않는다 (RHF useController가 defaultValues로 되돌려 수정
         * 화면에서 지운 값이 되살아남 — lib/validations/dispatch.ts 주석 참고).
         */
        nullable: true
        value: number | null
        onChange: (value: number | null) => void
      }
    | {
        /** 0 기본값 금액(공급가액·수수료·지출 금액): 0은 빈칸으로 보이고, 빈칸은 0. */
        nullable?: false
        value: number
        onChange: (value: number) => void
      }
  )

/**
 * 금액 입력칸: 숫자 키패드(inputMode=numeric), 입력 중 천 단위 쉼표, 큰 글씨 우측 정렬 + "원".
 * 금액은 원 단위 정수라 입력칸에는 숫자와 쉼표만 보인다(소수점은 나타나지 않음). 직접 입력한
 * 숫자 외 글자(".", "-" 등)와 거부하는 입력(상한 99,999,999,999 초과, 0이 아닌 소수부나 음수가
 * 든 붙여넣기)은 받지 않고 이전 표시와 커서 위치를 그대로 둔다. 문자열 ↔ 값 변환 규칙은
 * lib/money.ts의 순수 함수(applyAmountInputEdit/formatAmountInput)가 담당한다.
 */
export function AmountInput(props: AmountInputProps) {
  const {
    nullable,
    value,
    onChange,
    ref,
    className,
    ...inputProps
  } = props
  const emptyWhenZero = !nullable

  const display = formatAmountInput(value, { emptyWhenZero })

  const inputRef = useRef<HTMLInputElement | null>(null)
  const pendingCaretRef = useRef<number | null>(null)
  // 타이핑·붙여넣기 직전의 선택 범위(= 이번 입력이 교체하는 구간). 입력 후 문자열을 앞뒤로
  // 비교해 추측하면 선택 영역을 덮어쓸 때 같은 글자가 겹쳐 틀리므로, beforeinput 시점에 기록한다.
  const beforeInputRef = useRef<(AmountEditRange & { valueBefore: string }) | null>(
    null
  )

  const setRefs = useCallback(
    (element: HTMLInputElement | null) => {
      inputRef.current = element
      if (typeof ref === "function") ref(element)
      else if (ref) ref.current = element
    },
    [ref]
  )

  useEffect(() => {
    const element = inputRef.current
    if (!element) return

    function recordSelection(event: InputEvent) {
      // 삭제·조합 입력(IME)은 선택 범위가 곧 교체 구간이 아니므로 기록하지 않는다.
      const exact =
        event.inputType === "insertText" || event.inputType === "insertFromPaste"
      const target = event.target as HTMLInputElement
      beforeInputRef.current =
        exact && target.selectionStart !== null && target.selectionEnd !== null
          ? {
              start: target.selectionStart,
              end: target.selectionEnd,
              valueBefore: target.value,
            }
          : null
    }

    element.addEventListener("beforeinput", recordSelection)
    return () => element.removeEventListener("beforeinput", recordSelection)
  }, [])

  // 쉼표가 다시 들어간 뒤에도 커서를 사용자가 편집하던 숫자 바로 뒤에 둔다.
  useLayoutEffect(() => {
    const caret = pendingCaretRef.current
    const element = inputRef.current
    pendingCaretRef.current = null
    if (caret === null || !element || document.activeElement !== element) return
    element.setSelectionRange(caret, caret)
  })

  /**
   * 화면이 바뀌지 않는 편집(거부된 입력, 숫자가 아닌 글자): 값을 바꾸지 않으므로 React가 입력칸을
   * 이전 표시값으로 되돌리면서 커서가 맨 끝으로 간다. 되돌린 직후(같은 이벤트 처리가 끝난 뒤의
   * 마이크로태스크)에 편집 전 커서 위치로 돌려놓는다.
   */
  function restoreCaretAfterRevert(
    element: HTMLInputElement,
    nextText: string,
    caretAfterEdit: number,
    replacedRange?: AmountEditRange
  ) {
    const insertedLength = nextText.length - display.length
    const caretBeforeEdit = Math.min(
      Math.max(caretAfterEdit - insertedLength, 0),
      display.length
    )
    queueMicrotask(() => {
      if (document.activeElement !== element) return
      // 선택 영역 위에서 거부된 입력이면 선택 상태까지 그대로 되돌린다.
      if (replacedRange) {
        element.setSelectionRange(replacedRange.start, replacedRange.end)
      } else {
        element.setSelectionRange(caretBeforeEdit, caretBeforeEdit)
      }
    })
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const element = event.target
    const nextText = element.value
    const caret = element.selectionStart ?? nextText.length
    const nativeEvent = event.nativeEvent as InputEvent

    // beforeinput 없이 들어온 입력이나 직전 값과 맞지 않는 기록은 쓰지 않는다(그땐 앞뒤 비교로 해석).
    const recorded = beforeInputRef.current
    beforeInputRef.current = null
    const replacedRange =
      recorded && recorded.valueBefore === display
        ? { start: recorded.start, end: recorded.end }
        : undefined

    const result = applyAmountInputEdit({
      previousText: display,
      nextText,
      caret,
      inputType: nativeEvent.inputType,
      replacedRange,
      emptyWhenZero,
    })

    if (result.status !== "ok") {
      restoreCaretAfterRevert(element, nextText, caret, replacedRange)
      return
    }

    // nullable 모드만 null을 내보낸다 — 0 기본값 모드의 빈칸은 0.
    const nextValue = nullable ? result.value : (result.value ?? 0)
    const nextDisplay = formatAmountInput(nextValue, { emptyWhenZero })

    if (nextDisplay === display) {
      restoreCaretAfterRevert(element, nextText, caret, replacedRange)
      return
    }

    pendingCaretRef.current = result.caret
    // 판별 유니온의 두 onChange 시그니처를 합친 형태 (nullable일 때만 null이 나간다).
    const emit = onChange as (next: number | null) => void
    emit(nextValue)
  }

  return (
    <div className="relative">
      <Input
        {...inputProps}
        ref={setRefs}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        onChange={handleChange}
        className={cn(
          "pr-8 text-right text-lg font-semibold tabular-nums md:text-base",
          className
        )}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
      >
        원
      </span>
    </div>
  )
}
