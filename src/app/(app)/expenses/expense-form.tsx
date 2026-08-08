"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { startTransition, useActionState, useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { EXPENSE_PAYMENT_METHOD_OPTIONS } from "@/lib/constants/payment-method"
import {
  EXPENSE_CATEGORY_MAJORS,
  getMinorCategories,
  isValidCategoryPair,
} from "@/lib/constants/expense-categories"
import { getTodayInSeoul } from "@/lib/date"
import {
  expenseFormSchema,
  type ExpenseFormValues,
} from "@/lib/validations/expense"

import type { ExpenseActionState } from "./actions"

interface ExpenseFormProps {
  action: (
    prevState: ExpenseActionState,
    formData: FormData
  ) => Promise<ExpenseActionState>
  defaultValues: ExpenseFormValues
  submitLabel: string
}

function buildFormData(values: ExpenseFormValues): FormData {
  const fd = new FormData()
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) return
    fd.set(key, String(value))
  })
  return fd
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
  const minorOptions = getMinorCategories(categoryMajor)
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
      formAction(buildFormData(values))
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4 pb-24 md:pb-0"
      >
        <FormField
          control={form.control}
          name="expense_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>지출일자 *</FormLabel>
              <FormControl>
                <Input {...field} type="date" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>금액 *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    value={field.value === 0 ? "" : field.value}
                    onChange={(e) => {
                      const next =
                        e.target.value === "" ? 0 : e.target.valueAsNumber
                      field.onChange(Number.isNaN(next) ? 0 : next)
                    }}
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
                <Tabs value={field.value} onValueChange={field.onChange}>
                  <TabsList className="w-full">
                    {EXPENSE_PAYMENT_METHOD_OPTIONS.map((option) => (
                      <TabsTrigger key={option.value} value={option.value}>
                        {option.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="category_major"
            render={({ field }) => (
              <FormItem>
                <FormLabel>대분류 *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="대분류 선택" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EXPENSE_CATEGORY_MAJORS.map((major) => (
                      <SelectItem key={major} value={major}>
                        {major}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Select
                  value={isCustomMinor ? "기타" : field.value}
                  onValueChange={(v) => {
                    if (v === "기타") {
                      setIsCustomMinor(true)
                      field.onChange("")
                    } else {
                      setIsCustomMinor(false)
                      field.onChange(v)
                    }
                  }}
                  disabled={!categoryMajor}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="소분류 선택" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {minorOptions.map((minor) => (
                      <SelectItem key={minor} value={minor}>
                        {minor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

        <div className="fixed inset-x-0 bottom-16 border-t bg-background p-3 md:static md:bottom-auto md:border-0 md:p-0">
          <Button
            type="submit"
            className="w-full md:w-auto"
            disabled={isPending}
          >
            {isPending ? "저장 중..." : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  )
}
