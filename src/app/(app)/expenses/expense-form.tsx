"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { startTransition, useActionState, useEffect } from "react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

  useEffect(() => {
    const currentMinor = form.getValues("category_minor")
    if (currentMinor && !minorOptions.includes(currentMinor)) {
      form.setValue("category_minor", "")
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
                  value={field.value}
                  onValueChange={field.onChange}
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
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="vendor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>거래처/상호</FormLabel>
              <FormControl>
                <Input {...field} />
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
              <FormLabel>결제수단</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {EXPENSE_PAYMENT_METHOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
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
          name="has_tax_invoice"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              </FormControl>
              <FormLabel className="!mt-0">증빙(계산서) 수취</FormLabel>
            </FormItem>
          )}
        />

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
