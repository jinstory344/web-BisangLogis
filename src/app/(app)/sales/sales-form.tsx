"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown } from "lucide-react"
import { startTransition, useActionState, useId, useState } from "react"
import { useForm } from "react-hook-form"

import { AmountInput } from "@/components/form/amount-input"
import { ChoiceChips, toChoiceOptions } from "@/components/form/choice-chips"
import { DateQuickPicker } from "@/components/form/date-quick-picker"
import { FormSubmitBar, touchFormProps } from "@/components/form/form-submit-bar"
import { RecentRouteChips } from "@/components/form/recent-route-chips"
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
import { Textarea } from "@/components/ui/textarea"
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants/payment-method"
import {
  SOURCE_CLIENT_MINOR_OPTIONS,
  SOURCE_MAJOR_OPTIONS,
} from "@/lib/constants/source"
import { getTodayInSeoul } from "@/lib/date"
import { calcVatFromSupply, formatAmountInput, formatKRW } from "@/lib/money"
import type { RecentRoute } from "@/lib/quick-entry"
import { cn } from "@/lib/utils"
import {
  buildSaleFormData,
  saleFormSchema,
  type SaleFormValues,
} from "@/lib/validations/sales"

import {
  checkDuplicateSaleAction,
  searchBillingEntityNameSuggestionsAction,
  searchDestinationSuggestionsAction,
  searchOriginSuggestionsAction,
  type SaleActionState,
} from "./actions"

const SOURCE_MAJOR_CHOICES = toChoiceOptions(SOURCE_MAJOR_OPTIONS)
const SOURCE_CLIENT_MINOR_CHOICES = toChoiceOptions(SOURCE_CLIENT_MINOR_OPTIONS)
/** 대분류가 이 값일 때만 소분류가 칩(SOURCE_CLIENT_MINOR_OPTIONS)이고, 그 외엔 자유 입력이다. */
const CLIENT_SOURCE_MAJOR = "거래처"

interface SalesFormProps {
  action: (
    prevState: SaleActionState,
    formData: FormData
  ) => Promise<SaleActionState>
  defaultValues: SaleFormValues
  submitLabel: string
  /** 새 등록·복사 등록 화면에서만 넘긴다. 없으면(수정 화면) 최근 구간 칩을 그리지 않는다. */
  recentRoutes?: RecentRoute[]
}

/** "더보기"에 접어 두는 필드(오더자 전화번호·계산서정보·비고) 중 값이 있는지 — 있으면 펼친 채로 연다. */
function hasMoreSectionValues(values: SaleFormValues): boolean {
  return [
    values.order_contact_phone,
    values.billing_entity_name,
    values.memo,
  ].some((value) => value.trim() !== "")
}

/**
 * 매출 등록/수정 폼. 매출은 실제 수익(직접 운행 또는 업체 수수료) 기록이므로
 * 배차 폼(dispatch-form.tsx)과 달리 거래처/차량/기사/화물 정보를 다루지 않는다.
 */
export function SalesForm({
  action,
  defaultValues,
  submitLabel,
  recentRoutes,
}: SalesFormProps) {
  const [state, formAction, isPending] = useActionState(action, {
    error: null,
  })
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null)
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false)
  const moreSectionId = useId()
  const [isMoreOpen, setIsMoreOpen] = useState(() =>
    hasMoreSectionValues(defaultValues)
  )

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
  const origin = form.watch("origin")
  const destination = form.watch("destination")

  function applyRecentRoute(route: RecentRoute) {
    form.setValue("origin", route.origin, {
      shouldValidate: true,
      shouldDirty: true,
    })
    form.setValue("destination", route.destination, {
      shouldValidate: true,
      shouldDirty: true,
    })
  }

  function handleSourceMajorChange(next: string) {
    const previous = form.getValues("source_major")
    form.setValue("source_major", next, { shouldDirty: true })
    // "거래처"(소분류 칩) ↔ 그 외(소분류 자유 입력)로 바뀌면 소분류 값의 의미가 달라진다.
    // 그대로 두면 칩에 표시되지 않는 값이 저장되거나, 거래처명이 자유 입력칸에 남는다.
    if (
      (previous === CLIENT_SOURCE_MAJOR) !==
      (next === CLIENT_SOURCE_MAJOR)
    ) {
      form.setValue("source_minor", "", { shouldDirty: true })
    }
  }

  async function onSubmit(values: SaleFormValues) {
    const fd = buildSaleFormData(values)

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
      <form onSubmit={form.handleSubmit(onSubmit)} {...touchFormProps}>
        <FormField
          control={form.control}
          name="sale_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>매출일자 *</FormLabel>
              <FormControl>
                <DateQuickPicker
                  value={field.value}
                  onChange={field.onChange}
                  aria-label="매출일자"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>상차지 *</FormLabel>
          <FreeTextCombobox
            value={origin}
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
            value={destination}
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

        {recentRoutes ? (
          <RecentRouteChips
            routes={recentRoutes}
            origin={origin}
            destination={destination}
            onSelect={applyRecentRoute}
          />
        ) : null}

        <h2 className="mt-2 text-sm font-semibold text-muted-foreground">
          운임
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="supply_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>공급가액 *</FormLabel>
                <FormControl>
                  <AmountInput
                    ref={field.ref}
                    name={field.name}
                    onBlur={field.onBlur}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0"
                  />
                </FormControl>
                {/* 모바일: 세액·합계 칸 대신 한 줄 요약 (데스크톱은 오른쪽 두 칸) */}
                <p className="text-right text-sm text-muted-foreground tabular-nums md:hidden">
                  세액 {formatKRW(vatAmount)} · 합계{" "}
                  <span className="font-medium text-foreground">
                    {formatKRW(totalAmount)}
                  </span>
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormItem className="hidden md:grid">
            <FormLabel>세액</FormLabel>
            <FormControl>
              <Input
                className="text-right tabular-nums"
                value={formatAmountInput(vatAmount)}
                disabled
                readOnly
              />
            </FormControl>
          </FormItem>
          <FormItem className="hidden md:grid">
            <FormLabel>합계</FormLabel>
            <FormControl>
              <Input
                className="text-right tabular-nums"
                value={formatAmountInput(totalAmount)}
                disabled
                readOnly
              />
            </FormControl>
          </FormItem>
        </div>

        <FormField
          control={form.control}
          name="is_vat_exempt"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-3">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              </FormControl>
              {/* 라벨까지 눌러도 체크되도록 라벨 행을 모바일 44px 터치 영역으로 넓힌다. */}
              <FormLabel className="!mt-0 min-h-11 flex-1 cursor-pointer md:min-h-0 md:flex-none">
                현금
              </FormLabel>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="payment_method"
          render={({ field }) => (
            <FormItem>
              <FormLabel>지불방법</FormLabel>
              <FormControl>
                <ChoiceChips
                  aria-label="지불방법"
                  options={PAYMENT_METHOD_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <h2 className="mt-2 text-sm font-semibold text-muted-foreground">
          출처
        </h2>

        <FormField
          control={form.control}
          name="source_major"
          render={({ field }) => (
            <FormItem>
              <FormLabel>대분류</FormLabel>
              <FormControl>
                <ChoiceChips
                  aria-label="출처 대분류"
                  allowDeselect
                  options={SOURCE_MAJOR_CHOICES}
                  value={field.value}
                  onChange={handleSourceMajorChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {sourceMajor === CLIENT_SOURCE_MAJOR ? (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="source_minor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>소분류</FormLabel>
                  <FormControl>
                    <ChoiceChips
                      aria-label="출처 소분류"
                      allowDeselect
                      options={SOURCE_CLIENT_MINOR_CHOICES}
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
              name="source_note"
              render={({ field }) => (
                <FormItem className="content-start">
                  <FormLabel>비고</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="비고" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : (
          <FormField
            control={form.control}
            name="source_minor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>소분류</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="소분류 직접 입력" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* 모바일 "더보기": 자주 비워 두는 필드를 접는다. 값이 있으면(수정·복사) 펼친 채로 연다.
            데스크톱은 기존처럼 항상 펼쳐 둔다. */}
        <button
          type="button"
          aria-expanded={isMoreOpen}
          aria-controls={moreSectionId}
          onClick={() => setIsMoreOpen((open) => !open)}
          className="flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
        >
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0">더보기</span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              오더자 전화번호 · 계산서정보 · 비고
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              isMoreOpen && "rotate-180"
            )}
          />
        </button>

        <div
          id={moreSectionId}
          className={cn("flex-col gap-4 md:flex", isMoreOpen ? "flex" : "hidden")}
        >
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
        </div>

        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}

        <FormSubmitBar disabled={isPending || isCheckingDuplicate}>
          {isPending
            ? "저장 중..."
            : isCheckingDuplicate
              ? "중복 확인 중..."
              : submitLabel}
        </FormSubmitBar>
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
