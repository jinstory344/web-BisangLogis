"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { startTransition, useActionState } from "react"
import { useForm } from "react-hook-form"

import { FormSubmitBar, touchFormProps } from "@/components/form/form-submit-bar"
import { SheetChoice } from "@/components/form/sheet-choice"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  PALLET_COUNT_OPTIONS,
  VEHICLE_BODY_TYPES,
  vehicleFormSchema,
  type VehicleFormValues,
} from "@/lib/validations/vehicle"

const BODY_TYPE_OPTIONS = VEHICLE_BODY_TYPES.map((v) => ({ value: v, label: v }))
const PALLET_OPTIONS = PALLET_COUNT_OPTIONS.map((n) => ({ value: String(n), label: `${n}p` }))

import type { VehicleActionState } from "./actions"

interface VehicleFormProps {
  action: (
    prevState: VehicleActionState,
    formData: FormData
  ) => Promise<VehicleActionState>
  defaultValues: VehicleFormValues
  submitLabel: string
}

export function VehicleForm({
  action,
  defaultValues,
  submitLabel,
}: VehicleFormProps) {
  const [state, formAction, isPending] = useActionState(action, {
    error: null,
  })
  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues,
  })

  function onSubmit(values: VehicleFormValues) {
    const fd = new FormData()
    Object.entries(values).forEach(([key, value]) => fd.set(key, value))
    startTransition(() => {
      formAction(fd)
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        {...touchFormProps}
      >
        <FormField
          control={form.control}
          name="plate_no"
          render={({ field }) => (
            <FormItem>
              <FormLabel>차량번호 *</FormLabel>
              <FormControl>
                <Input {...field} autoFocus placeholder="서울86바1234" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="driver_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>차주 *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="이름" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="driver_phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>연락처</FormLabel>
              <FormControl>
                <Input {...field} type="tel" inputMode="tel" placeholder="010-0000-0000" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="vehicle_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>차종</FormLabel>
              <SheetChoice
                title="차종"
                options={BODY_TYPE_OPTIONS}
                value={field.value}
                placeholder="차종 선택"
                allowDeselect
                onChange={field.onChange}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="pallet_count"
          render={({ field }) => (
            <FormItem>
              <FormLabel>파렛수</FormLabel>
              <SheetChoice
                title="파렛수"
                options={PALLET_OPTIONS}
                value={field.value}
                placeholder="파렛수 선택"
                allowDeselect
                onChange={field.onChange}
              />
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

        <FormSubmitBar disabled={isPending}>
          {isPending ? "저장 중..." : submitLabel}
        </FormSubmitBar>
      </form>
    </Form>
  )
}
