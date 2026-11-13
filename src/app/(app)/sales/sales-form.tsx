"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown } from "lucide-react"
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { useForm } from "react-hook-form"

import { AmountInput } from "@/components/form/amount-input"
import { AmountKeypadField } from "@/components/form/amount-keypad"
import { DateRow } from "@/components/form/date-row"
import { FormSubmitBar, touchFormProps } from "@/components/form/form-submit-bar"
import { RecentContactChips } from "@/components/form/recent-contact-chips"
import { SheetChoice } from "@/components/form/sheet-choice"
import { INCOME_TEXT_CLASS } from "@/components/ledger/colors"
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
import { FreeTextCombobox } from "@/components/common/free-text-combobox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants/payment-method"
import { DEFAULT_SALE_SOURCE_TREE } from "@/lib/constants/sale-sources"
import { SOURCE_MAJOR_CLIENT } from "@/lib/constants/source"
import { getTodayInSeoul } from "@/lib/date"
import {
  calcVatFromSupply,
  formatAmountInput,
  isVatExemptForPayment,
} from "@/lib/money"
import { nextBillingEntityName, type SaleClientChoice } from "@/lib/sale-clients"
import { cn } from "@/lib/utils"
import {
  buildSaleFormData,
  saleFormSchema,
  type SaleFormValues,
} from "@/lib/validations/sales"

import {
  searchBillingEntityNameSuggestionsAction,
  searchDestinationSuggestionsAction,
  searchOriginSuggestionsAction,
  type SaleActionState,
} from "./actions"
import { type PickedSaleClient } from "./client-source-picker"
import { ClientSourceRow } from "./client-source-row"
import { SourcePickerSheet } from "./source-picker-sheet"
import type { SaleSources } from "./sources"
import { useRecentSaleContacts } from "./use-recent-sale-contacts"

interface SalesFormProps {
  action: (
    prevState: SaleActionState,
    formData: FormData
  ) => Promise<SaleActionState>
  defaultValues: SaleFormValues
  submitLabel: string
  /**
   * 출처 "거래처"의 소분류로 고를 수 있는 거래처 명단(매출에서 많이 쓴 순).
   * 거래처 페이지에 등록된 거래처를 그대로 쓴다. 조회에 실패하면 비워서 넘겨도 폼은 쓸 수 있다.
   */
  clientChoices?: SaleClientChoice[]
  /** 출처 목록(대분류 › 하위분류)과 편집 가능 여부. 못 읽으면 기본 대분류만. */
  sources?: SaleSources
}

/**
 * 거래처가 아닌 출처(지인·카카오톡 등)는 오더자(소분류)와 계산서 받을 업체가 다른 경우가 흔해서
 * 계산서정보를 연락처 바로 아래에 보여 준다. 거래처이거나 출처 미선택이면 더보기에 접어 둔다.
 */
function isBillingShownAbove(sourceMajor: string): boolean {
  return sourceMajor !== "" && sourceMajor !== SOURCE_MAJOR_CLIENT
}

/** "＋"에 접어 두는 필드(연락처·계산서정보·출처 비고) 중 값이 있는지 — 있으면 펼친 채로 연다. */
function hasMoreSectionValues(values: SaleFormValues): boolean {
  // 거래처 이름으로 자동 채운 계산서정보는 거래처 아래에 이미 작게 보이므로 펼칠 이유가 아니다.
  const billing = values.billing_entity_name.trim()
  const billingNeedsShowing =
    !isBillingShownAbove(values.source_major) &&
    billing !== "" &&
    billing !== values.source_minor.trim()
  return (
    billingNeedsShowing ||
    [values.order_contact_phone, values.source_note].some(
      (value) => value.trim() !== ""
    )
  )
}

/**
 * 매출 등록/수정 폼. 매출은 실제 수익(직접 운행 또는 업체 수수료) 기록이므로
 * 배차 폼(dispatch-form.tsx)과 달리 거래처/차량/기사/화물 정보를 다루지 않는다.
 */
export function SalesForm({
  action,
  defaultValues,
  submitLabel,
  clientChoices = [],
  sources = { tree: DEFAULT_SALE_SOURCE_TREE, editable: false },
}: SalesFormProps) {
  const [state, formAction, isPending] = useActionState(action, {
    error: null,
  })
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null)
  // 마지막으로 보낸 값 — 서버가 "중복"이라고 하면 확인 창에서 그대로 다시 보낸다
  const lastFormDataRef = useRef<FormData | null>(null)
  useEffect(() => {
    if (state.duplicate && lastFormDataRef.current) {
      setPendingFormData(lastFormDataRef.current)
    }
  }, [state])
  const moreSectionId = useId()
  const originInputId = useId()
  // 새 등록(금액이 비어 있음)이면 화면을 열자마자 금액 키패드를 띄운다. 수정·복사는 띄우지 않는다.
  const [autoOpenKeypad] = useState(() => defaultValues.supply_amount === 0)
  const [isMoreOpen, setIsMoreOpen] = useState(() =>
    hasMoreSectionValues(defaultValues)
  )
  // 출처 비고 칸은 새로 만들지 않는다 — 이미 값이 있는 건(수정·복사)에서만 더보기에 보여 줘서 값이 사라지지 않게 한다.
  const [showSourceNote] = useState(
    () => defaultValues.source_note.trim() !== ""
  )

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      ...defaultValues,
      sale_date: defaultValues.sale_date || getTodayInSeoul(),
    },
  })

  const supplyAmount = form.watch("supply_amount")
  // 세액은 지불방법이 세금계산서일 때만 붙는다 (계좌이체·현금은 세액 없음).
  const isVatExempt = isVatExemptForPayment(form.watch("payment_method"))
  const { vatAmount, totalAmount } = calcVatFromSupply(
    Number.isFinite(supplyAmount) ? supplyAmount : 0,
    isVatExempt
  )
  const sourceMajor = form.watch("source_major")
  const sourceMinor = form.watch("source_minor")
  const clientId = form.watch("client_id")
  const billingEntityName = form.watch("billing_entity_name")
  const orderContactPhone = form.watch("order_contact_phone")
  const origin = form.watch("origin")
  const destination = form.watch("destination")
  const recentContacts = useRecentSaleContacts(sourceMajor, sourceMinor)
  const billingShownAbove = isBillingShownAbove(sourceMajor)

  function handleSourceMajorChange(next: string) {
    const previous = form.getValues("source_major")
    form.setValue("source_major", next, { shouldDirty: true })
    // "거래처"(소분류 칩) ↔ 그 외(소분류 자유 입력)로 바뀌면 소분류 값의 의미가 달라진다.
    // 그대로 두면 칩에 표시되지 않는 값이 저장되거나, 거래처명이 자유 입력칸에 남는다.
    if (
      (previous === SOURCE_MAJOR_CLIENT) !==
      (next === SOURCE_MAJOR_CLIENT)
    ) {
      const previousMinor = form.getValues("source_minor")
      form.setValue("source_minor", "", { shouldDirty: true })

      // 거래처를 벗어나면 거래처 연결도 끊고, 거래처 이름으로 자동 입력했던 계산서정보만 비운다.
      if (previous === SOURCE_MAJOR_CLIENT) {
        form.setValue("client_id", "", { shouldDirty: true })
        const cleared = nextBillingEntityName({
          currentBilling: form.getValues("billing_entity_name"),
          previousClientName: previousMinor,
          nextClientName: null,
        })
        if (cleared !== null) {
          form.setValue("billing_entity_name", cleared, { shouldDirty: true })
        }
      }
    }
    // 계산서정보 칸이 연락처 아래에서 더보기로 옮겨 가면, 이미 적은 값이 접힌 곳에 숨지 않게 펼친다.
    if (
      !isBillingShownAbove(next) &&
      form.getValues("billing_entity_name").trim() !== ""
    ) {
      setIsMoreOpen(true)
    }
  }

  /**
   * 소분류 거래처를 고르거나 해제한다. 소분류에는 거래처 이름을 그대로 남기고(이름 스냅샷),
   * 계산서정보는 비어 있거나 이전 거래처 이름 그대로일 때만 새 거래처 이름으로 채운다.
   * 연락처는 담당자가 건마다 달라 덮어쓰지 않는다 (최근 연락처 칩으로 고른다).
   */
  function handleClientChange(client: PickedSaleClient | null) {
    const previousName = form.getValues("source_minor")
    const nextBilling = nextBillingEntityName({
      currentBilling: form.getValues("billing_entity_name"),
      previousClientName: previousName,
      nextClientName: client?.name ?? null,
    })

    form.setValue("client_id", client?.id ?? "", { shouldDirty: true })
    form.setValue("source_minor", client?.name ?? "", { shouldDirty: true })
    if (nextBilling !== null) {
      form.setValue("billing_entity_name", nextBilling, { shouldDirty: true })
    }
  }

  function handlePaymentMethodChange(
    next: SaleFormValues["payment_method"],
    onChange: (value: SaleFormValues["payment_method"]) => void
  ) {
    onChange(next)
    form.setValue("is_vat_exempt", isVatExemptForPayment(next))
  }

  async function onSubmit(values: SaleFormValues) {
    const fd = buildSaleFormData(values)

    // 중복 확인은 서버가 저장하면서 함께 한다(왕복 한 번). 중복이면 state.duplicate로 알려 준다.
    lastFormDataRef.current = fd

    // useActionState의 formAction을 handleSubmit 콜백에서 수동 호출할 때는
    // 반드시 transition으로 감싼다 (감싸지 않으면 폼이 클라이언트에서 크래시).
    startTransition(() => {
      formAction(fd)
    })
  }

  function handleConfirmDuplicate() {
    if (pendingFormData) {
      pendingFormData.set("confirm_duplicate", "1")
      startTransition(() => {
        formAction(pendingFormData)
      })
    }
    setPendingFormData(null)
  }

  // 계산서정보 칸은 한 번에 한 곳에만 그린다: 거래처 외 출처면 연락처 아래, 아니면 더보기 안.
  const billingField = (
    <FormItem>
      <FormLabel>사업자 정보</FormLabel>
      <FreeTextCombobox
        value={form.watch("billing_entity_name")}
        onChange={(v) => form.setValue("billing_entity_name", v)}
        fetchSuggestions={searchBillingEntityNameSuggestionsAction}
        placeholder={
          billingShownAbove
            ? "계산서 받을 업체 (직접 입력 가능)"
            : "사업자 정보 (직접 입력 가능)"
        }
      />
    </FormItem>
  )
  const moreSummary = [
    "연락처",
    billingShownAbove ? null : "사업자 정보",
    showSourceNote ? "출처 비고" : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} {...touchFormProps}>
        {/* 금액 먼저 (가계부 앱 방식). 모바일은 계산기 키패드, 데스크톱은 공급가액·세액·합계 세 칸. */}
        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="supply_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>금액 *</FormLabel>
                <div className="md:hidden">
                  <AmountKeypadField
                    title="금액 (공급가액)"
                    value={field.value}
                    onChange={field.onChange}
                    autoOpen={autoOpenKeypad}
                    amountClassName={INCOME_TEXT_CLASS}
                    placeholder="공급가액"
                    invalid={Boolean(form.formState.errors.supply_amount)}
                    extra={
                      field.value > 0
                        ? isVatExempt
                          ? `세액 없음 · 합계 ${formatAmountInput(totalAmount)}`
                          : `세액 ${formatAmountInput(vatAmount)} · 합계 ${formatAmountInput(totalAmount)}`
                        : null
                    }
                    // 금액 다음은 상차지로 바로 (누른 순간에 커서를 옮겨야 폰 키보드가 뜬다)
                    onNext={() => document.getElementById(originInputId)?.focus()}
                  />
                </div>
                <div className="hidden md:block">
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
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormItem className="hidden md:grid">
            <FormLabel>세액</FormLabel>
            <Input
              className="text-right tabular-nums"
              value={isVatExempt ? "" : formatAmountInput(vatAmount)}
              placeholder={isVatExempt ? "세액 없음" : undefined}
              disabled
              readOnly
            />
          </FormItem>
          <FormItem className="hidden md:grid">
            <FormLabel>합계</FormLabel>
            <Input
              className="text-right tabular-nums"
              value={formatAmountInput(totalAmount)}
              disabled
              readOnly
            />
          </FormItem>
        </div>

        <FormField
          control={form.control}
          name="sale_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>날짜 *</FormLabel>
              <DateRow value={field.value} onChange={field.onChange} label="매출일자" />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>상차지 *</FormLabel>
          <FreeTextCombobox
            inputId={originInputId}
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

        <FormField
          control={form.control}
          name="payment_method"
          render={({ field }) => (
            <FormItem>
              <FormLabel>지불</FormLabel>
              <SheetChoice
                title="지불방법"
                options={PAYMENT_METHOD_OPTIONS}
                value={field.value}
                onChange={(next) =>
                  handlePaymentMethodChange(next, field.onChange)
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>출처</FormLabel>
          {/* 대분류 › 하위분류 (예: 카카오톡 › 스마일). 오더자 이름은 아래 줄에 따로 적는다. */}
          <SourcePickerSheet
            initialTree={sources.tree}
            editable={sources.editable}
            major={sourceMajor}
            sub={form.watch("source_sub")}
            onPick={(nextMajor, nextSub) => {
              handleSourceMajorChange(nextMajor)
              form.setValue("source_sub", nextSub, { shouldDirty: true })
            }}
          />
          {form.formState.errors.source_major ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.source_major.message}
            </p>
          ) : null}
        </FormItem>

        {sourceMajor === SOURCE_MAJOR_CLIENT ? (
          <FormItem>
            <FormLabel>거래처</FormLabel>
            <ClientSourceRow
              choices={clientChoices}
              clientId={clientId}
              sourceMinor={sourceMinor}
              onChange={handleClientChange}
            />
            {/* 계산서정보는 더보기에 접혀 있으므로, 거래처로 자동 입력된 값을 여기서 바로 보여 준다. */}
            {clientId && billingEntityName.trim() ? (
              <p className="text-xs text-muted-foreground">
                사업자 정보: {billingEntityName.trim()}
              </p>
            ) : null}
          </FormItem>
        ) : sourceMajor || sourceMinor ? (
          <FormField
            control={form.control}
            name="source_minor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>오더자</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="이름 또는 업체명" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {billingShownAbove ? billingField : null}

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

        {/* 모바일 "＋" 줄: 자주 비워 두는 칸을 접는다. 값이 있으면(수정·복사) 펼친 채로 연다.
            데스크톱은 기존처럼 항상 펼쳐 둔다. */}
        <button
          type="button"
          aria-expanded={isMoreOpen}
          aria-controls={moreSectionId}
          onClick={() => setIsMoreOpen((open) => !open)}
          className="flex min-h-11 items-center justify-between gap-2 text-left text-sm text-muted-foreground md:hidden"
        >
          <span className="truncate">＋ {moreSummary}</span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 transition-transform",
              isMoreOpen && "rotate-180"
            )}
          />
        </button>

        <div
          id={moreSectionId}
          className={cn("flex-col gap-4 md:flex", isMoreOpen ? "flex" : "hidden")}
        >
          {/* 연락처: 같은 거래처라도 담당자가 건마다 달라, 자동으로 채우지 않고 최근 연락처를 칩으로만 제안한다. */}
          <FormField
            control={form.control}
            name="order_contact_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>연락처</FormLabel>
                <FormControl>
                  <Input {...field} type="tel" placeholder="010-0000-0000" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <RecentContactChips
            // 매출은 소분류가 곧 오더자라 이름 없이 번호만 쓴다.
            contacts={recentContacts.map((phone) => ({ name: "", phone }))}
            value={{ name: "", phone: orderContactPhone }}
            onSelect={(contact) =>
              form.setValue("order_contact_phone", contact.phone, {
                shouldDirty: true,
              })
            }
          />

          {billingShownAbove ? null : billingField}

          {showSourceNote ? (
            <FormField
              control={form.control}
              name="source_note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>출처 비고</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="출처 비고" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
        </div>

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
