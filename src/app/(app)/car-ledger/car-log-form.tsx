"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { startTransition, useActionState, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { ServiceItemsField, serviceLinesTotal, type ServiceLineValue } from "@/components/car-ledger/service-items-field"
import { AmountInput } from "@/components/form/amount-input"
import { AmountKeypadField } from "@/components/form/amount-keypad"
import { ChoiceChips, toChoiceOptions } from "@/components/form/choice-chips"
import { DateRow } from "@/components/form/date-row"
import { FormSubmitBar, touchFormProps } from "@/components/form/form-submit-bar"
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
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FUEL_KIND, isLiterKind, SERVICE_KIND } from "@/lib/car-ledger/constants"
import { buildCarLogFormData, carLogFormSchema, type CarLogFormValues } from "@/lib/validations/car-log"

import { deleteCarLogAction, type CarLogActionState } from "./actions"

/** 장소 칸 이름: 정비면 정비소, 주유·요소수면 주유소, 그 밖은 장소 */
function vendorLabel(kind: string): string {
  if (kind === SERVICE_KIND) return "정비소"
  if (kind === FUEL_KIND || isLiterKind(kind)) return "주유소"
  return "장소"
}

/**
 * 차계부 기록(승용차 등) 등록·수정 폼: 날짜 · 종류 칩 · 금액 · (주유)리터 · km · 장소 · (정비)항목 줄 · 비고.
 * 수정 화면이면 아래에 삭제(휴지통으로).
 */
export function CarLogForm({
  action,
  defaultValues,
  submitLabel,
  kinds,
  serviceItemNames,
  deleteId,
  returnTo,
}: {
  action: (prev: CarLogActionState, formData: FormData) => Promise<CarLogActionState>
  defaultValues: CarLogFormValues
  submitLabel: string
  /** 기록 종류 목록 (주유·정비·세차 …) */
  kinds: string[]
  serviceItemNames: string[]
  /** 수정 화면이면 그 기록 id (삭제 버튼이 나온다) */
  deleteId?: string
  /** 삭제 뒤 돌아갈 곳 */
  returnTo: string
}) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(action, { error: null })
  const form = useForm<CarLogFormValues>({
    resolver: zodResolver(carLogFormSchema),
    defaultValues,
  })
  const kind = form.watch("kind")
  const [autoOpenKeypad] = useState(() => defaultValues.amount === 0)
  const [amountFollowsItems, setAmountFollowsItems] = useState(() => defaultValues.amount === 0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, startDelete] = useTransition()
  // 지운 종류의 옛 기록도 고칠 수 있게 지금 값은 칩에 남긴다
  const kindOptions = toChoiceOptions(kinds.includes(defaultValues.kind) || !defaultValues.kind ? kinds : [...kinds, defaultValues.kind])

  function changeAmount(onChange: (value: number) => void, value: number) {
    setAmountFollowsItems(false)
    onChange(value)
  }

  function changeServiceItems(lines: ServiceLineValue[]) {
    form.setValue("service_items", lines, { shouldValidate: true })
    const total = serviceLinesTotal(lines)
    if (total > 0 && (amountFollowsItems || form.getValues("amount") === 0)) {
      setAmountFollowsItems(true)
      form.setValue("amount", total, { shouldValidate: true })
    }
  }

  function onSubmit(values: CarLogFormValues) {
    startTransition(() => {
      formAction(buildCarLogFormData(values))
    })
  }

  function remove() {
    if (!deleteId) return
    startDelete(async () => {
      const result = await deleteCarLogAction(deleteId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("휴지통으로 옮겼어요")
      setConfirmDelete(false)
      router.replace(returnTo)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} {...touchFormProps}>
        <FormField
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormItem>
              <FormLabel>종류 *</FormLabel>
              <ChoiceChips options={kindOptions} value={field.value} onChange={field.onChange} aria-label="기록 종류" />
              <FormMessage />
            </FormItem>
          )}
        />

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
                  onChange={(value) => changeAmount(field.onChange, value)}
                  autoOpen={autoOpenKeypad}
                  amountClassName={EXPENSE_TEXT_CLASS}
                  placeholder="금액"
                  invalid={Boolean(form.formState.errors.amount)}
                />
              </div>
              <div className="hidden md:block">
                <FormControl>
                  <AmountInput
                    ref={field.ref}
                    name={field.name}
                    onBlur={field.onBlur}
                    value={field.value}
                    onChange={(value) => changeAmount(field.onChange, value)}
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
          name="log_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>날짜 *</FormLabel>
              <DateRow value={field.value} onChange={field.onChange} label="날짜" />
              <FormMessage />
            </FormItem>
          )}
        />

        {kind === SERVICE_KIND ? (
          <FormField
            control={form.control}
            name="service_items"
            render={({ field }) => (
              <FormItem>
                <FormLabel>정비 항목</FormLabel>
                <ServiceItemsField names={serviceItemNames} value={field.value} onChange={changeServiceItems} />
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {isLiterKind(kind) ? (
          <FormField
            control={form.control}
            name="liters"
            render={({ field }) => (
              <FormItem>
                <FormLabel>리터</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input {...field} inputMode="decimal" placeholder="넣은 양 (안 적어도 돼요)" className="h-11 flex-1 text-right" />
                  </FormControl>
                  <span className="shrink-0 text-base text-muted-foreground">L</span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <FormField
          control={form.control}
          name="odometer_km"
          render={({ field }) => (
            <FormItem>
              <FormLabel>주행거리</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input {...field} inputMode="numeric" placeholder="계기판 km (안 적어도 돼요)" className="h-11 flex-1 text-right" />
                </FormControl>
                <span className="shrink-0 text-base text-muted-foreground">km</span>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="vendor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{vendorLabel(kind)}</FormLabel>
              <FormControl>
                <Input {...field} placeholder="안 적어도 돼요" className="h-11" />
              </FormControl>
              <FormMessage />
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

        {deleteId ? (
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-fit text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            이 기록 삭제
          </Button>
        ) : null}

        <FormSubmitBar disabled={isPending || isDeleting}>{isPending ? "저장 중..." : submitLabel}</FormSubmitBar>
      </form>

      <AlertDialog open={confirmDelete} onOpenChange={(open) => !isDeleting && setConfirmDelete(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 기록을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>휴지통으로 옮겨져요. 30일 안에는 되살릴 수 있어요.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>아니요</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault()
                remove()
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
