"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { startTransition, useActionState, useState } from "react"
import { useForm } from "react-hook-form"

import type { ClientSearchResult } from "@/app/(app)/clients/actions"
import { ClientCombobox } from "@/components/clients/client-combobox"
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
import { VehicleCombobox } from "@/components/vehicles/vehicle-combobox"
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants/payment-method"
import { getTodayInSeoul } from "@/lib/date"
import { formatKRW, splitVat } from "@/lib/money"
import {
  dispatchFormSchema,
  type DispatchFormValues,
} from "@/lib/validations/dispatch"

import {
  checkDuplicateDispatchAction,
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
}

function buildFormData(values: DispatchFormValues): FormData {
  const fd = new FormData()
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) return
    fd.set(key, String(value))
  })
  return fd
}

export function DispatchForm({
  action,
  defaultValues,
  defaultClient,
  submitLabel,
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

  const totalAmount = form.watch("total_amount")
  const isVatExempt = form.watch("is_vat_exempt")
  const dispatchDate = form.watch("dispatch_date")
  const { supplyAmount, vatAmount } = splitVat(
    Number.isFinite(totalAmount) ? totalAmount : 0,
    isVatExempt
  )
  // 문자열(yyyy-MM-dd) 그대로 비교 — Date로 파싱하면 UTC 자정으로 해석되어
  // 로컬 타임존에 따라 "오늘"도 미래로 잘못 판정될 수 있다.
  const isFutureDate =
    !!dispatchDate && dispatchDate > getTodayInSeoul()

  async function onSubmit(values: DispatchFormValues) {
    const fd = buildFormData(values)

    setIsCheckingDuplicate(true)
    try {
      const isDuplicate = await checkDuplicateDispatchAction({
        dispatchDate: values.dispatch_date,
        clientId: values.client_id,
        origin: values.origin,
        destination: values.destination,
        plateNoSnapshot: values.plate_no_snapshot,
        totalAmount: values.total_amount,
      })

      if (isDuplicate) {
        setPendingFormData(fd)
        return
      }
    } finally {
      setIsCheckingDuplicate(false)
    }

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
          name="dispatch_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>운송일자 *</FormLabel>
              <FormControl>
                <Input {...field} type="date" />
              </FormControl>
              {isFutureDate ? (
                <p className="text-sm text-amber-600">
                  미래 일자입니다. 확인 후 저장하세요.
                </p>
              ) : null}
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
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? undefined : e.target.valueAsNumber
                    )
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>차량 (직접 입력 가능)</FormLabel>
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
                <FormLabel>기사명</FormLabel>
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
                <FormLabel>기사 연락처</FormLabel>
                <FormControl>
                  <Input {...field} type="tel" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="carrier_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>운수사</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dispatcher_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>배차자</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="total_amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>합계 운임 *</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                />
              </FormControl>
              <p className="text-sm text-muted-foreground">
                공급가액 {formatKRW(supplyAmount)} / 부가세 {formatKRW(vatAmount)}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

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
              <FormLabel className="!mt-0">면세 (부가세 없음)</FormLabel>
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
              운송일자·거래처·상차지·하차지·차량번호·합계운임이 동일한 배차
              건이 이미 등록되어 있습니다. 그래도 저장하시겠습니까?
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
