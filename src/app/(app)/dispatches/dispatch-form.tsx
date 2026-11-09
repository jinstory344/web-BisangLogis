"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { startTransition, useActionState, useState } from "react"
import { useForm } from "react-hook-form"

import type { ClientSearchResult } from "@/app/(app)/clients/actions"
import { ClientCombobox } from "@/components/clients/client-combobox"
import { AmountInput } from "@/components/form/amount-input"
import { ChoiceChips } from "@/components/form/choice-chips"
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
import type { RecentRoute } from "@/lib/quick-entry"
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} {...touchFormProps}>
        <FormField
          control={form.control}
          name="dispatch_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>운송일자 *</FormLabel>
              <FormControl>
                <DateQuickPicker
                  value={field.value}
                  onChange={field.onChange}
                  aria-label="운송일자"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <h2 className="mt-2 text-sm font-semibold text-muted-foreground">
          거래처 정보
        </h2>

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
          <FormLabel>담당자</FormLabel>
          <FreeTextCombobox
            value={form.watch("contact_name")}
            onChange={(v) => form.setValue("contact_name", v)}
            fetchSuggestions={searchContactNameSuggestionsAction}
            placeholder="담당자명"
          />
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
              <FormControl>
                <ChoiceChips
                  aria-label="하차일"
                  options={DROPOFF_TYPE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <h2 className="mt-2 text-sm font-semibold text-muted-foreground">
          화물내용
        </h2>

        <FormField
          control={form.control}
          name="cargo_box_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>차종 선택</FormLabel>
              {/* 선택 칩을 다시 누르면 해제 = "선택 안 함". 폼 상태의 미선택은 기존 규칙대로
                  ""이고, 서버 액션이 `|| null`로 정규화해 RPC에 넘긴다. */}
              <FormControl>
                <ChoiceChips
                  aria-label="차종 선택"
                  allowDeselect
                  options={CARGO_BOX_TYPE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="pallet_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>파렛 수량</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
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
                    min={0}
                    step={0.01}
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

        <FormItem>
          <FormLabel>차량정보</FormLabel>
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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="driver_name_snapshot"
            render={({ field }) => (
              <FormItem>
                <FormLabel>이름</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                  <Input {...field} type="tel" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <h2 className="mt-2 text-sm font-semibold text-muted-foreground">
          지급 정보
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="freight_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>운임</FormLabel>
                <FormControl>
                  {/* 미입력은 null로 둬야 "값 없음"과 0이 구분되고, 수정 폼에서
                      지웠을 때 RHF가 defaultValues로 되돌리지 않는다. */}
                  <AmountInput
                    nullable
                    ref={field.ref}
                    name={field.name}
                    onBlur={field.onBlur}
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
            name="fee_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>수수료</FormLabel>
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
