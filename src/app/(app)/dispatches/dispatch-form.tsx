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
import { CARGO_BOX_TYPE_OPTIONS } from "@/lib/constants/cargo-box-type"
import { DROPOFF_TYPE_OPTIONS } from "@/lib/constants/dropoff-type"
import { getTodayInSeoul } from "@/lib/date"
import {
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

/** 적재함 종류 "선택 안 함"을 나타내는 Select 전용 센티넬 값(폼 상태에는 ""로 저장). */
const CARGO_BOX_TYPE_NONE = "__NONE__"

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
    // null/undefined(미입력)는 아예 전송하지 않는다 — String(null)이 "null"이라는
    // 문자열로 직렬화되어 서버에서 NaN이 되는 것을 막는다.
    // 서버의 coerceDispatchFormData가 "전송되지 않음"을 null로 되돌린다.
    if (value === undefined || value === null) return
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

        <FormField
          control={form.control}
          name="cargo_box_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>차종 선택</FormLabel>
              {/* Radix Select은 SelectItem에 빈 문자열을 허용하지 않으므로
                  "선택 안 함"은 센티넬 값으로 표현하고 폼 상태에는 ""로 저장한다. */}
              <Select
                value={field.value || CARGO_BOX_TYPE_NONE}
                onValueChange={(value) =>
                  field.onChange(value === CARGO_BOX_TYPE_NONE ? "" : value)
                }
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="선택 안 함" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={CARGO_BOX_TYPE_NONE}>선택 안 함</SelectItem>
                  {CARGO_BOX_TYPE_OPTIONS.map((option) => (
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
            name="fee_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>수수료</FormLabel>
                <FormControl>
                  {/* 기본값 0을 빈 칸으로 보여줘야 앞자리 0이 남는 입력 버그를 피한다. */}
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
        </div>

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
