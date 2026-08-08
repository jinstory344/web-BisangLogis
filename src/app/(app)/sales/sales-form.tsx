"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { startTransition, useActionState, useState } from "react"
import { useForm } from "react-hook-form"

import type { ClientSearchResult } from "@/app/(app)/clients/actions"
import {
  checkDuplicateDispatchAction,
  searchCarrierNameSuggestionsAction,
  searchContactNameSuggestionsAction,
  searchDestinationSuggestionsAction,
  searchOriginSuggestionsAction,
  type DispatchActionState,
} from "@/app/(app)/dispatches/actions"
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
import { DROPOFF_TYPE_OPTIONS } from "@/lib/constants/dropoff-type"
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants/payment-method"
import {
  SOURCE_CLIENT_MINOR_OPTIONS,
  SOURCE_MAJOR_OPTIONS,
} from "@/lib/constants/source"
import { getTodayInSeoul } from "@/lib/date"
import { calcVatFromSupply } from "@/lib/money"
import {
  dispatchFormSchema,
  type DispatchFormValues,
} from "@/lib/validations/dispatch"

interface SalesFormProps {
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

/**
 * 매출 등록/수정 폼. 배차 등록 폼(dispatch-form.tsx)과 같은 dispatches
 * 테이블·RPC를 공유하지만, 서로 다른 화면이므로 독립된 컴포넌트로 관리한다 —
 * 배차 쪽 필드 구성을 바꿔도 매출 쪽에 영향이 없어야 하고, 그 반대도 마찬가지다.
 */
export function SalesForm({
  action,
  defaultValues,
  defaultClient,
  submitLabel,
}: SalesFormProps) {
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

  const supplyAmount = form.watch("supply_amount")
  const isVatExempt = form.watch("is_vat_exempt")
  const { vatAmount, totalAmount } = calcVatFromSupply(
    Number.isFinite(supplyAmount) ? supplyAmount : 0,
    isVatExempt
  )
  const sourceMajor = form.watch("source_major")

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
        supplyAmount: values.supply_amount,
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
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
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
          <FormLabel>사업자정보</FormLabel>
          <FreeTextCombobox
            value={form.watch("carrier_name")}
            onChange={(v) => form.setValue("carrier_name", v)}
            fetchSuggestions={searchCarrierNameSuggestionsAction}
            placeholder="사업자정보 (직접 입력 가능)"
          />
        </FormItem>

        <FormField
          control={form.control}
          name="dropoff_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>하차일</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {DROPOFF_TYPE_OPTIONS.map((option) => (
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
          화물내용
        </h2>

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
          name="fee_amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>수수료</FormLabel>
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
              운송일자·거래처·상차지·하차지·차량번호·공급가액이 동일한 건이
              이미 등록되어 있습니다. 그래도 저장하시겠습니까?
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
