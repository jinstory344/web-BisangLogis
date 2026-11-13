"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { startTransition, useActionState, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { AmountInput } from "@/components/form/amount-input"
import { AmountKeypadField } from "@/components/form/amount-keypad"
import { DateRow } from "@/components/form/date-row"
import { FormSubmitBar, touchFormProps } from "@/components/form/form-submit-bar"
import { SheetChoice } from "@/components/form/sheet-choice"
import { EXPENSE_TEXT_CLASS } from "@/components/ledger/colors"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  CUSTOM_MINOR,
  getMinorsOf,
  type DeleteCategoryInput,
  type ExpenseCategoryTree,
} from "@/lib/constants/expense-categories"
import { getTodayInSeoul } from "@/lib/date"
import {
  buildExpenseFormData,
  expenseFormSchema,
  type ExpenseFormValues,
} from "@/lib/validations/expense"

import type { ExpenseActionState } from "./actions"
import { CategoryPickerSheet } from "./category-picker-sheet"
import {
  addExpenseCategoryAction,
  deleteExpenseCategoryAction,
} from "./category-actions"

interface ExpenseFormProps {
  action: (
    prevState: ExpenseActionState,
    formData: FormData
  ) => Promise<ExpenseActionState>
  defaultValues: ExpenseFormValues
  submitLabel: string
  /** 분류 목록 (DB) */
  categories: ExpenseCategoryTree
  /** 분류를 직접 추가·삭제할 수 있는지 (분류 테이블을 읽었을 때만 true) */
  categoriesEditable: boolean
}

export function ExpenseForm({
  action,
  defaultValues,
  submitLabel,
  categories,
  categoriesEditable,
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

  // 새 등록(금액이 비어 있음)이면 화면을 열자마자 금액 키패드를 띄운다. 수정·복사는 띄우지 않는다.
  const [autoOpenKeypad] = useState(() => defaultValues.amount === 0)
  const categoryMajor = form.watch("category_major")
  const paymentMethod = form.watch("payment_method")

  // 분류 목록은 서버에서 받은 것으로 시작하고, 추가·삭제하면 서버가 돌려준 새 목록으로 바꾼다.
  const [tree, setTree] = useState<ExpenseCategoryTree>(categories)
  const [pendingDelete, setPendingDelete] = useState<DeleteCategoryInput | null>(
    null
  )
  const [isDeleting, setIsDeleting] = useState(false)

  const [isCustomMinor, setIsCustomMinor] = useState(() => {
    const initialMinor = defaultValues.category_minor
    const initialMinors = getMinorsOf(categories, defaultValues.category_major)
    return initialMinor !== "" && !initialMinors.includes(initialMinor)
  })

  /** 분류 선택판에서 고른 대분류·소분류를 폼에 넣는다. "기타"면 직접 입력칸을 연다. */
  function pickCategory(major: string, minor: string) {
    form.setValue("category_major", major, { shouldValidate: true })
    if (minor === CUSTOM_MINOR) {
      setIsCustomMinor(true)
      form.setValue("category_minor", "")
    } else {
      setIsCustomMinor(false)
      form.setValue("category_minor", minor, { shouldValidate: true })
    }
  }

  async function addMajor(name: string): Promise<string | null> {
    const result = await addExpenseCategoryAction({ kind: "major", name })
    if (!result.ok) return result.error
    setTree(result.tree)
    return null
  }

  async function addMinor(major: string, name: string): Promise<string | null> {
    const result = await addExpenseCategoryAction({ kind: "minor", major, name })
    if (!result.ok) return result.error
    setTree(result.tree)
    return null
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const target = pendingDelete
    setIsDeleting(true)
    try {
      const result = await deleteExpenseCategoryAction(target)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setTree(result.tree)
      // 지금 고른 분류를 지웠다면 선택도 비운다.
      if (target.minor === undefined && categoryMajor === target.major) {
        form.setValue("category_major", "")
        form.setValue("category_minor", "")
        setIsCustomMinor(false)
      } else if (
        target.minor !== undefined &&
        categoryMajor === target.major &&
        form.getValues("category_minor") === target.minor &&
        !isCustomMinor
      ) {
        form.setValue("category_minor", "")
      }
      toast.success("분류를 삭제했습니다")
    } catch {
      toast.error("분류를 삭제하지 못했어요. 잠시 뒤 다시 시도하세요")
    } finally {
      setIsDeleting(false)
      setPendingDelete(null)
    }
  }

  function onSubmit(values: ExpenseFormValues) {
    startTransition(() => {
      formAction(buildExpenseFormData(values))
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} {...touchFormProps}>
        {/* 금액 먼저 (가계부 앱 방식). 모바일은 계산기 키패드, 데스크톱은 기존 입력칸. */}
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>금액 *</FormLabel>
              <div className="md:hidden">
                <AmountKeypadField
                  title="금액"
                  value={field.value}
                  onChange={field.onChange}
                  autoOpen={autoOpenKeypad}
                  amountClassName={EXPENSE_TEXT_CLASS}
                  placeholder="금액"
                  invalid={Boolean(form.formState.errors.amount)}
                />
              </div>
              <div className="hidden md:block">
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
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="expense_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>날짜 *</FormLabel>
              <DateRow value={field.value} onChange={field.onChange} label="지출일자" />
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 분류: 한 줄을 누르면 아래에서 분류 선택판이 올라온다 (가계부 앱 방식). */}
        <FormField
          control={form.control}
          name="category_minor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>분류 *</FormLabel>
              <CategoryPickerSheet
                tree={tree}
                major={categoryMajor}
                minor={field.value}
                isCustom={isCustomMinor}
                editable={categoriesEditable}
                onPick={pickCategory}
                onAddMajor={addMajor}
                onAddMinor={addMinor}
                onRemove={setPendingDelete}
                invalid={Boolean(
                  form.formState.errors.category_major ||
                    form.formState.errors.category_minor
                )}
              />
              {isCustomMinor ? (
                <Input
                  placeholder={`${categoryMajor} 소분류 직접 입력`}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              ) : null}
              {form.formState.errors.category_major ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.category_major.message}
                </p>
              ) : (
                <FormMessage />
              )}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="payment_method"
          render={({ field }) => (
            <FormItem>
              <FormLabel>결제</FormLabel>
              <SheetChoice
                title="결제방법"
                options={EXPENSE_PAYMENT_METHOD_OPTIONS}
                value={field.value ?? ""}
                onChange={(method) => {
                  field.onChange(method)
                  // 카드가 아니면 할부 칸이 사라지므로 이미 고른 할부도 지운다.
                  if (method !== "CARD") {
                    form.setValue("installment_months", undefined)
                  }
                }}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 할부는 결제방법이 카드일 때만 보인다. */}
        {paymentMethod === "CARD" ? (
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
                      <SelectValue placeholder="일시불" />
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
        ) : null}

        <FormField
          control={form.control}
          name="memo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>비고</FormLabel>
              <FormControl>
                <Textarea {...field} rows={1} className="min-h-11 md:min-h-16" />
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

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && !isDeleting && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.minor !== undefined
                ? `소분류 '${pendingDelete.minor}'을(를) 삭제할까요?`
                : `대분류 '${pendingDelete?.major ?? ""}'을(를) 삭제할까요?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && pendingDelete.minor === undefined
                ? `아래 소분류 ${
                    getMinorsOf(tree, pendingDelete.major).filter(
                      (minor) => minor !== CUSTOM_MINOR
                    ).length
                  }개도 함께 목록에서 사라집니다. `
                : ""}
              이미 등록한 지출 내역은 그대로 남아요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>아니요</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                // 삭제가 끝난 뒤에 창을 닫도록 기본 닫힘을 막는다.
                event.preventDefault()
                void confirmDelete()
              }}
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  )
}
