"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { startTransition, useActionState, useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import { AmountInput } from "@/components/form/amount-input"
import { ChoiceChips, toChoiceOptions } from "@/components/form/choice-chips"
import { DateQuickPicker } from "@/components/form/date-quick-picker"
import { FormSubmitBar, touchFormProps } from "@/components/form/form-submit-bar"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { EXPENSE_PAYMENT_METHOD_OPTIONS } from "@/lib/constants/payment-method"
import {
  EXPENSE_CATEGORY_MAJORS,
  getMinorCategories,
  isValidCategoryPair,
} from "@/lib/constants/expense-categories"
import { getTodayInSeoul } from "@/lib/date"
import {
  buildExpenseFormData,
  expenseFormSchema,
  type ExpenseFormValues,
} from "@/lib/validations/expense"

import type { ExpenseActionState } from "./actions"

const CATEGORY_MAJOR_CHOICES = toChoiceOptions(EXPENSE_CATEGORY_MAJORS)
/** 소분류 칩 중 이 값을 고르면 아래에 직접 입력칸이 열리고, 입력한 텍스트가 소분류로 저장된다. */
const CUSTOM_MINOR = "기타"

interface ExpenseFormProps {
  action: (
    prevState: ExpenseActionState,
    formData: FormData
  ) => Promise<ExpenseActionState>
  defaultValues: ExpenseFormValues
  submitLabel: string
}

export function ExpenseForm({
  action,
  defaultValues,
  submitLabel,
}: ExpenseFormProps) {
  const [state, formAction, isPending] = useActionState(action, {
    error: null,
  })
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      ...defaultValues,
      expense_date: defaultValues.expense_date || getTodayInSeoul(),
    },
  })

  const categoryMajor = form.watch("category_major")
  const minorChoices = toChoiceOptions(getMinorCategories(categoryMajor))
  const [isCustomMinor, setIsCustomMinor] = useState(() => {
    const initialMinor = defaultValues.category_minor
    const initialMinors = getMinorCategories(defaultValues.category_major)
    return initialMinor !== "" && !initialMinors.includes(initialMinor)
  })

  useEffect(() => {
    const currentMinor = form.getValues("category_minor")
    if (currentMinor && !isValidCategoryPair(categoryMajor, currentMinor)) {
      form.setValue("category_minor", "")
      setIsCustomMinor(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryMajor])

  function onSubmit(values: ExpenseFormValues) {
    startTransition(() => {
      formAction(buildExpenseFormData(values))
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} {...touchFormProps}>
        <FormField
          control={form.control}
          name="expense_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>지출일자 *</FormLabel>
              <FormControl>
                <DateQuickPicker
                  value={field.value}
                  onChange={field.onChange}
                  aria-label="지출일자"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 모바일은 한 줄에 하나씩, 데스크톱은 기존처럼 금액·결제방법·할부 한 줄
            (결제방법 칩이 줄바꿈되지 않도록 가운데 열은 내용 너비). */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>금액 *</FormLabel>
                <FormControl>
                  {/* 기본값 0을 빈 칸으로 보여줘야 앞자리 0이 남는 입력 버그를 피한다. */}
                  <AmountInput
                    ref={field.ref}
                    name={field.name}
                    onBlur={field.onBlur}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="payment_method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>결제방법</FormLabel>
                <FormControl>
                  <ChoiceChips
                    aria-label="결제방법"
                    options={EXPENSE_PAYMENT_METHOD_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    className="md:flex-nowrap"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="installment_months"
            render={({ field }) => (
              <FormItem>
                <FormLabel>할부</FormLabel>
                <Select
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(v) =>
                    field.onChange(v ? Number(v) : undefined)
                  }
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="할부 선택" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(
                      (month) => (
                        <SelectItem key={month} value={String(month)}>
                          {month}개월
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* 소분류 칩은 대분류에 따라 바뀌고 개수가 많아(최대 9개) 데스크톱에서도 위아래로 둔다. */}
        <div className="grid gap-4">
          <FormField
            control={form.control}
            name="category_major"
            render={({ field }) => (
              <FormItem>
                <FormLabel>대분류 *</FormLabel>
                <FormControl>
                  <ChoiceChips
                    aria-label="대분류"
                    options={CATEGORY_MAJOR_CHOICES}
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="category_minor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>소분류 *</FormLabel>
                {categoryMajor ? (
                  <FormControl>
                    <ChoiceChips
                      aria-label="소분류"
                      options={minorChoices}
                      value={isCustomMinor ? CUSTOM_MINOR : field.value}
                      onChange={(v) => {
                        if (v === CUSTOM_MINOR) {
                          setIsCustomMinor(true)
                          field.onChange("")
                        } else {
                          setIsCustomMinor(false)
                          field.onChange(v)
                        }
                      }}
                    />
                  </FormControl>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    대분류를 먼저 선택하세요
                  </p>
                )}
                {isCustomMinor ? (
                  <Input
                    placeholder="소분류 직접 입력"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="memo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>비고</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}

        <FormSubmitBar disabled={isPending}>
          {isPending ? "저장 중..." : submitLabel}
        </FormSubmitBar>
      </form>
    </Form>
  )
}
