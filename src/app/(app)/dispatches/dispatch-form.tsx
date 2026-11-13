"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown } from "lucide-react"
import { startTransition, useActionState, useId, useState } from "react"
import { useForm } from "react-hook-form"

import type { ClientSearchResult } from "@/app/(app)/clients/actions"
import { ClientCombobox } from "@/components/clients/client-combobox"
import { AmountInput } from "@/components/form/amount-input"
import { AmountKeypadField } from "@/components/form/amount-keypad"
import { DateRow } from "@/components/form/date-row"
import { FormSubmitBar, touchFormProps } from "@/components/form/form-submit-bar"
import { RecentContactChips } from "@/components/form/recent-contact-chips"
import { RecentRouteChips } from "@/components/form/recent-route-chips"
import { SheetChoice } from "@/components/form/sheet-choice"
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
import { VehicleCombobox } from "@/components/vehicles/vehicle-combobox"
import { CARGO_BOX_TYPE_OPTIONS } from "@/lib/constants/cargo-box-type"
import { DROPOFF_TYPE_OPTIONS } from "@/lib/constants/dropoff-type"
import { getTodayInSeoul } from "@/lib/date"
import { formatAmountInput } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { RecentContact, RecentRoute } from "@/lib/quick-entry"
import {
  buildDispatchFormData,
  dispatchFormSchema,
  type DispatchFormValues,
} from "@/lib/validations/dispatch"

import {
  checkDuplicateDispatchAction,
  searchContactNameSuggestionsAction,
  searchDestinationSuggestionsAction,
  searchOriginSuggestionsAction,
  type DispatchActionState,
} from "./actions"
import { useRecentDispatchContacts } from "./use-recent-dispatch-contacts"

interface DispatchFormProps {
  action: (
    prevState: DispatchActionState,
    formData: FormData
  ) => Promise<DispatchActionState>
  defaultValues: DispatchFormValues
  defaultClient: ClientSearchResult | null
  submitLabel: string
  /** 새 등록·복사 등록 화면에서만 넘긴다. 없으면(수정 화면) 최근 구간 칩을 그리지 않는다. */
  recentRoutes?: RecentRoute[]
}

export function DispatchForm({
  action,
  defaultValues,
  defaultClient,
  submitLabel,
  recentRoutes,
}: DispatchFormProps) {
  const [state, formAction, isPending] = useActionState(action, {
    error: null,
  })
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(
    defaultClient
  )
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null)
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false)

  const form = useForm<DispatchFormValues>({
    resolver: zodResolver(dispatchFormSchema),
    defaultValues: {
      ...defaultValues,
      dispatch_date: defaultValues.dispatch_date || getTodayInSeoul(),
    },
  })

  const origin = form.watch("origin")
  const destination = form.watch("destination")
  const clientId = form.watch("client_id")
  const contactName = form.watch("contact_name")
  const contactPhone = form.watch("contact_phone")
  const recentContacts = useRecentDispatchContacts(clientId)
  const feeAmount = form.watch("fee_amount")
  const moreSectionId = useId()
  // "＋"에 접어 둔 칸(차종·파렛·중량·수수료·비고) 중 값이 있으면(수정·복사) 펼친 채로 연다.
  const [isMoreOpen, setIsMoreOpen] = useState(
    () =>
      defaultValues.cargo_box_type !== "" ||
      defaultValues.pallet_count !== null ||
      defaultValues.weight_ton !== null ||
      defaultValues.fee_amount > 0 ||
      defaultValues.memo.trim() !== ""
  )

  function applyRecentContact(contact: RecentContact) {
    form.setValue("contact_name", contact.name, { shouldDirty: true })
    form.setValue("contact_phone", contact.phone, { shouldDirty: true })
  }

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

  async function onSubmit(values: DispatchFormValues) {
    const fd = buildDispatchFormData(values)

    setIsCheckingDuplicate(true)
    try {
      const isDuplicate = await checkDuplicateDispatchAction({
        dispatchDate: values.dispatch_date,
        clientId: values.client_id,
        origin: values.origin,
        destination: values.destination,
        plateNoSnapshot: values.plate_no_snapshot,
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

  /**
   * 수수료 칸 (일부 거래처만). 데스크톱은 운임 옆에 기존 입력칸, 모바일은 "＋" 안에 키패드 줄.
   * 한 화면에는 둘 중 하나만 보이지만 둘 다 같은 폼 값을 쓴다.
   */
  function feeField(kind: "mobile" | "desktop") {
    return (
      <FormField
        control={form.control}
        name="fee_amount"
        render={({ field }) => (
          <FormItem>
            <FormLabel>수수료</FormLabel>
            {kind === "mobile" ? (
              <AmountKeypadField
                title="수수료"
                value={field.value}
                onChange={field.onChange}
                placeholder="없음"
              />
            ) : (
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
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} {...touchFormProps}>
        <FormField
          control={form.control}
          name="dispatch_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>날짜 *</FormLabel>
              <DateRow value={field.value} onChange={field.onChange} label="운송일자" />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>거래처 *</FormLabel>
          <ClientCombobox
            value={selectedClient}
            onChange={(client) => {
              setSelectedClient(client)
              form.setValue("client_id", client?.id ?? "", {
                shouldValidate: true,
              })
              form.setValue("client_name", client?.name ?? "")
            }}
          />
          {form.formState.errors.client_id ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.client_id.message}
            </p>
          ) : null}
        </FormItem>

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

        <FormField
          control={form.control}
          name="dropoff_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>하차일</FormLabel>
              <SheetChoice
                title="하차일"
                options={DROPOFF_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>차량</FormLabel>
          <VehicleCombobox
            plateNo={form.watch("plate_no_snapshot")}
            onPlateNoChange={(v) => form.setValue("plate_no_snapshot", v)}
            onVehicleSelected={(vehicle) => {
              form.setValue("vehicle_id", vehicle?.id ?? "")
              form.setValue("driver_name_snapshot", vehicle?.driver_name ?? "")
              form.setValue(
                "driver_phone_snapshot",
                vehicle?.driver_phone ?? ""
              )
            }}
          />
        </FormItem>

        <div className="grid gap-0 md:grid-cols-2 md:gap-4">
          <FormField
            control={form.control}
            name="driver_name_snapshot"
            render={({ field }) => (
              <FormItem>
                <FormLabel>기사</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="기사 이름" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="driver_phone_snapshot"
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
        </div>

        <div className="grid gap-0 md:grid-cols-2 md:gap-4">
          <FormField
            control={form.control}
            name="freight_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>운임</FormLabel>
                {/* 미입력은 null로 둬야 "값 없음"과 0이 구분되고, 수정 폼에서
                    지웠을 때 RHF가 defaultValues로 되돌리지 않는다. */}
                <div className="md:hidden">
                  <AmountKeypadField
                    nullable
                    title="운임"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="운임"
                    extra={feeAmount > 0 ? `수수료 ${formatAmountInput(feeAmount)}` : null}
                  />
                </div>
                <div className="hidden md:block">
                  <FormControl>
                    <AmountInput
                      nullable
                      ref={field.ref}
                      name={field.name}
                      onBlur={field.onBlur}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* 수수료: 데스크톱은 운임 옆, 모바일은 아래 "＋" 안 */}
          <div className="hidden md:block">{feeField("desktop")}</div>
        </div>

        {/* 담당자는 거래처마다, 건마다 달라서 자동으로 채우지 않고 같은 거래처의 최근 담당자를
            칩으로만 제안한다. 칩을 누르면 이름과 연락처를 함께 채운다. */}
        <FormItem>
          <FormLabel>담당자</FormLabel>
          <FreeTextCombobox
            value={contactName}
            onChange={(v) => form.setValue("contact_name", v)}
            fetchSuggestions={searchContactNameSuggestionsAction}
            placeholder="담당자명"
          />
        </FormItem>

        <FormField
          control={form.control}
          name="contact_phone"
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
          label="최근 담당자"
          contacts={recentContacts}
          value={{ name: contactName, phone: contactPhone }}
          onSelect={applyRecentContact}
        />

        {/* 모바일 "＋" 줄: 자주 비워 두는 칸을 접는다. 값이 있으면(수정·복사) 펼친 채로 연다.
            데스크톱은 항상 펼쳐 둔다. */}
        <button
          type="button"
          aria-expanded={isMoreOpen}
          aria-controls={moreSectionId}
          onClick={() => setIsMoreOpen((open) => !open)}
          className="flex min-h-11 items-center justify-between gap-2 text-left text-sm text-muted-foreground md:hidden"
        >
          <span className="truncate">＋ 화물(차종·파렛·톤) · 수수료 · 비고</span>
          <ChevronDown
            aria-hidden
            className={cn("size-4 shrink-0 transition-transform", isMoreOpen && "rotate-180")}
          />
        </button>

        <div
          id={moreSectionId}
          className={cn("flex-col gap-4 md:flex", isMoreOpen ? "flex" : "hidden")}
        >
          <FormField
            control={form.control}
            name="cargo_box_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>차종</FormLabel>
                {/* 선택 해제 = "선택 안 함". 폼 상태의 미선택은 기존 규칙대로 ""이고,
                    서버 액션이 `|| null`로 정규화해 RPC에 넘긴다. */}
                <SheetChoice
                  title="차종"
                  allowDeselect
                  options={CARGO_BOX_TYPE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-0 md:grid-cols-2 md:gap-4">
            <FormField
              control={form.control}
              name="pallet_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>파렛</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="수량"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const next = e.target.valueAsNumber
                        field.onChange(
                          e.target.value === "" || Number.isNaN(next) ? null : next
                        )
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="weight_ton"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>중량</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      placeholder="톤"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const next = e.target.valueAsNumber
                        field.onChange(
                          e.target.value === "" || Number.isNaN(next) ? null : next
                        )
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="md:hidden">{feeField("mobile")}</div>

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
              운송일자·거래처·상차지·하차지·차량번호가 동일한 배차 건이 이미
              등록되어 있습니다. 그래도 저장하시겠습니까?
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
