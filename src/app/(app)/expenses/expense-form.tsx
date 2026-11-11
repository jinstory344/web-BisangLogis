"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { startTransition, useActionState, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { AmountInput } from "@/components/form/amount-input"
import { ChoiceChips, toChoiceOptions } from "@/components/form/choice-chips"
import { DateQuickPicker } from "@/components/form/date-quick-picker"
import { FormSubmitBar, touchFormProps } from "@/components/form/form-submit-bar"
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
  getMajors,
  getMinorsOf,
  isValidCategoryPairIn,
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
import { CategoryAdder } from "./category-adder"
import {
  addExpenseCategoryAction,
  deleteExpenseCategoryAction,
} from "./category-actions"
import { RemovableCategoryChips } from "./removable-category-chips"

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

  const categoryMajor = form.watch("category_major")
  const paymentMethod = form.watch("payment_method")

  // 분류 목록은 서버에서 받은 것으로 시작하고, 추가·삭제하면 서버가 돌려준 새 목록으로 바꾼다.
  const [tree, setTree] = useState<ExpenseCategoryTree>(categories)
  const [isEditingCategories, setIsEditingCategories] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DeleteCategoryInput | null>(
    null
  )
  const [isDeleting, setIsDeleting] = useState(false)

  // 지운 분류가 붙은 예전 지출을 수정할 때도 지금 고른 대분류 칩은 보이도록 목록 밖의 값을 덧붙인다.
  const majorNames = getMajors(tree)
  const visibleMajors =
    categoryMajor && !majorNames.includes(categoryMajor)
      ? [...majorNames, categoryMajor]
      : majorNames
  const majorChoices = toChoiceOptions(visibleMajors)
  const minorNames = getMinorsOf(tree, categoryMajor)
  const minorChoices = toChoiceOptions(minorNames)
  const [isCustomMinor, setIsCustomMinor] = useState(() => {
    const initialMinor = defaultValues.category_minor
    const initialMinors = getMinorsOf(categories, defaultValues.category_major)
    return initialMinor !== "" && !initialMinors.includes(initialMinor)
  })

  /** 대분류를 바꿨을 때, 지금 소분류가 새 대분류에서 쓸 수 없는 값이면 비운다. */
  function handleMajorChange(next: string) {
    form.setValue("category_major", next, { shouldValidate: true })
    const currentMinor = form.getValues("category_minor")
    if (currentMinor && !isValidCategoryPairIn(tree, next, currentMinor)) {
      form.setValue("category_minor", "")
      setIsCustomMinor(false)
    }
  }

  async function addMajor(name: string): Promise<string | null> {
    const result = await addExpenseCategoryAction({ kind: "major", name })
    if (!result.ok) return result.error
    setTree(result.tree)
    // 방금 만든 대분류를 바로 고른다 (소분류는 새 대분류에서 다시 고른다).
    form.setValue("category_major", name.trim().replace(/\s+/g, " "), {
      shouldValidate: true,
    })
    form.setValue("category_minor", "")
    setIsCustomMinor(false)
    return null
  }

  async function addMinor(name: string): Promise<string | null> {
    const result = await addExpenseCategoryAction({
      kind: "minor",
      major: categoryMajor,
      name,
    })
    if (!result.ok) return result.error
    setTree(result.tree)
    // 방금 만든 소분류를 바로 고른다.
    setIsCustomMinor(false)
    form.setValue("category_minor", name.trim().replace(/\s+/g, " "), {
      shouldValidate: true,
    })
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
                    onChange={(method) => {
                      field.onChange(method)
                      // 카드가 아니면 할부 칸이 사라지므로 이미 고른 할부도 지운다.
                      if (method !== "CARD") {
                        form.setValue("installment_months", undefined)
                      }
                    }}
                    className="md:flex-nowrap"
                  />
                </FormControl>
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
          ) : null}
        </div>

        {/* 소분류 칩은 대분류에 따라 바뀌고 개수가 많아(최대 9개) 데스크톱에서도 위아래로 둔다. */}
        <div className="grid gap-4">
          {categoriesEditable ? (
            <div className="-mb-2 flex justify-end">
              <button
                type="button"
                aria-pressed={isEditingCategories}
                className="px-1 py-1 text-xs text-muted-foreground underline underline-offset-2"
                onClick={() => setIsEditingCategories((editing) => !editing)}
              >
                {isEditingCategories ? "편집 끝내기" : "분류 편집"}
              </button>
            </div>
          ) : null}

          <FormField
            control={form.control}
            name="category_major"
            render={({ field }) => (
              <FormItem>
                <FormLabel>대분류 *</FormLabel>
                {isEditingCategories ? (
                  <RemovableCategoryChips
                    aria-label="대분류 편집"
                    names={visibleMajors}
                    value={field.value}
                    onSelect={handleMajorChange}
                    onRemove={(major) => setPendingDelete({ major })}
                  />
                ) : (
                  <FormControl>
                    <ChoiceChips
                      aria-label="대분류"
                      options={majorChoices}
                      value={field.value}
                      onChange={handleMajorChange}
                    />
                  </FormControl>
                )}
                {categoriesEditable ? (
                  <CategoryAdder
                    label="대분류 추가"
                    placeholder="새 대분류 이름"
                    onAdd={addMajor}
                  />
                ) : null}
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
                  isEditingCategories ? (
                    <RemovableCategoryChips
                      aria-label="소분류 편집"
                      names={minorNames}
                      value={isCustomMinor ? CUSTOM_MINOR : field.value}
                      onSelect={(minor) => {
                        if (minor === CUSTOM_MINOR) {
                          setIsCustomMinor(true)
                          field.onChange("")
                        } else {
                          setIsCustomMinor(false)
                          field.onChange(minor)
                        }
                      }}
                      protectedNames={[CUSTOM_MINOR]}
                      onRemove={(minor) =>
                        setPendingDelete({ major: categoryMajor, minor })
                      }
                    />
                  ) : (
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
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">
                    대분류를 먼저 선택하세요
                  </p>
                )}
                {categoriesEditable && categoryMajor ? (
                  <CategoryAdder
                    label="소분류 추가"
                    placeholder={`${categoryMajor}에 추가할 소분류 이름`}
                    onAdd={addMinor}
                  />
                ) : null}
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
