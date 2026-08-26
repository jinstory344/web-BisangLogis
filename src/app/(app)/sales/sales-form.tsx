"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { startTransition, useActionState, useState } from "react"
import { useForm } from "react-hook-form"

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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { FreeTextCombobox } from "@/components/common/free-text-combobox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants/payment-method"
import {
  SOURCE_CLIENT_MINOR_OPTIONS,
  SOURCE_MAJOR_OPTIONS,
} from "@/lib/constants/source"
import { getTodayInSeoul } from "@/lib/date"
import { calcVatFromSupply } from "@/lib/money"
import { saleFormSchema, type SaleFormValues } from "@/lib/validations/sales"

import {
  checkDuplicateSaleAction,
  searchBillingEntityNameSuggestionsAction,
  searchDestinationSuggestionsAction,
  searchOriginSuggestionsAction,
  type SaleActionState,
} from "./actions"

interface SalesFormProps {
  action: (
    prevState: SaleActionState,
    formData: FormData
  ) => Promise<SaleActionState>
  defaultValues: SaleFormValues
  submitLabel: string
}

function buildFormData(values: SaleFormValues): FormData {
  const fd = new FormData()
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) return
    fd.set(key, String(value))
  })
  return fd
}

/**
 * 매출 등록/수정 폼. 매출은 실제 수익(직접 운행 또는 업체 수수료) 기록이므로
 * 배차 폼(dispatch-form.tsx)과 달리 거래처/차량/기사/화물 정보를 다루지 않는다.
 */
export function SalesForm({
  action,
  defaultValues,
  submitLabel,
}: SalesFormProps) {
  const [state, formAction, isPending] = useActionState(action, {
    error: null,
  })
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null)
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false)

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      ...defaultValues,
      sale_date: defaultValues.sale_date || getTodayInSeoul(),
    },
  })

  const supplyAmount = form.watch("supply_amount")
  const isVatExempt = form.watch("is_vat_exempt")
  const { vatAmount, totalAmount } = calcVatFromSupply(
    Number.isFinite(supplyAmount) ? supplyAmount : 0,
    isVatExempt
  )
  const sourceMajor = form.watch("source_major")

  async function onSubmit(values: SaleFormValues) {
    const fd = buildFormData(values)

    setIsCheckingDuplicate(true)
    try {
      const isDuplicate = await checkDuplicateSaleAction({
        saleDate: values.sale_date,
        origin: values.origin,
        destination: values.destination,
        supplyAmount: values.supply_amount,
      })

      if (isDuplicate) {
        setPendingFormData(fd)
        return
      }
    } finally {
      setIsCheckingDuplicate(false)
    }

    // useActionState의 formAction을 handleSubmit 콜백에서 수동 호출할 때는
    // 반드시 transition으로 감싼다 (감싸지 않으면 폼이 클라이언트에서 크래시).
    startTransition(() => {
      formAction(fd)
    })
  }

  function handleConfirmDuplicate() {
    if (pendingFormData) {
      startTransition(() => {
        formAction(pendingFormData)
      })
    }
    setPendingFormData(null)
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4 pb-24 md:pb-0"
      >
        <FormField
          control={form.control}
          name="sale_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>매출일자 *</FormLabel>
              <FormControl>
                <Input {...field} type="date" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>상차지 *</FormLabel>
          <FreeTextCombobox
            value={form.watch("origin")}
            onChange={(v) =>
              form.setValue("origin", v, { shouldValidate: true })
            }
            fetchSuggestions={searchOriginSuggestionsAction}
            placeholder="상차지"
          />
          {form.formState.errors.origin ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.origin.message}
            </p>
          ) : null}
        </FormItem>

        <FormItem>
          <FormLabel>하차지 *</FormLabel>
          <FreeTextCombobox
            value={form.watch("destination")}
            onChange={(v) =>
              form.setValue("destination", v, { shouldValidate: true })
            }
            fetchSuggestions={searchDestinationSuggestionsAction}
            placeholder="하차지"
          />
          {form.formState.errors.destination ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.destination.message}
            </p>
          ) : null}
        </FormItem>

        <h2 className="mt-2 text-sm font-semibold text-muted-foreground">
          운임
        </h2>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="supply_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>공급가액 *</FormLabel>
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
          <FormItem>
            <FormLabel>세액</FormLabel>
            <FormControl>
              <Input type="number" value={vatAmount} disabled readOnly />
            </FormControl>
          </FormItem>
          <FormItem>
            <FormLabel>합계</FormLabel>
            <FormControl>
              <Input type="number" value={totalAmount} disabled readOnly />
            </FormControl>
          </FormItem>
        </div>

        <FormField
          control={form.control}
          name="is_vat_exempt"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              </FormControl>
              <FormLabel className="!mt-0">현금</FormLabel>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="payment_method"
          render={({ field }) => (
            <FormItem>
              <FormLabel>지불방법</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
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

        <h2 className="mt-2 text-sm font-semibold text-muted-foreground">
          출처
        </h2>

        <div
          className={
            sourceMajor === "거래처"
              ? "grid grid-cols-3 gap-4"
              : "grid grid-cols-2 gap-4"
          }
        >
          <FormField
            control={form.control}
            name="source_major"
            render={({ field }) => (
              <FormItem>
                <FormLabel>대분류</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="대분류 선택" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SOURCE_MAJOR_OPTIONS.map((major) => (
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
            name="source_minor"
            render={({ field }) =>
              sourceMajor === "거래처" ? (
                <FormItem>
                  <FormLabel>소분류</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="소분류 선택" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SOURCE_CLIENT_MINOR_OPTIONS.map((minor) => (
                        <SelectItem key={minor} value={minor}>
                          {minor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              ) : (
                <FormItem>
                  <FormLabel>소분류</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="소분류 직접 입력" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }
          />
          {sourceMajor === "거래처" ? (
            <FormField
              control={form.control}
              name="source_note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>비고</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="비고" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
        </div>

        <FormField
          control={form.control}
          name="order_contact_phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>오더자 전화번호</FormLabel>
              <FormControl>
                <Input {...field} type="tel" placeholder="010-0000-0000" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>계산서정보</FormLabel>
          <FreeTextCombobox
            value={form.watch("billing_entity_name")}
            onChange={(v) => form.setValue("billing_entity_name", v)}
            fetchSuggestions={searchBillingEntityNameSuggestionsAction}
            placeholder="계산서정보 (직접 입력 가능)"
          />
        </FormItem>

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
            disabled={isPending || isCheckingDuplicate}
          >
            {isPending
              ? "저장 중..."
              : isCheckingDuplicate
                ? "중복 확인 중..."
                : submitLabel}
          </Button>
        </div>
      </form>

      <AlertDialog
        open={pendingFormData !== null}
        onOpenChange={(open) => !open && setPendingFormData(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>중복 가능성 있는 건이 있습니다</AlertDialogTitle>
            <AlertDialogDescription>
              매출일자·상차지·하차지·공급가액이 동일한 건이 이미 등록되어
              있습니다. 그래도 저장하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDuplicate}>
              그래도 저장
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  )
}
