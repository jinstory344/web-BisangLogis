"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { startTransition, useActionState } from "react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
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
  vehicleFormSchema,
  type VehicleFormValues,
} from "@/lib/validations/vehicle"

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
        className="flex flex-col gap-4 pb-24 md:pb-0"
      >
        <FormField
          control={form.control}
          name="plate_no"
          render={({ field }) => (
            <FormItem>
              <FormLabel>차량번호 *</FormLabel>
              <FormControl>
                <Input {...field} autoFocus />
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
              <FormLabel>기사명 *</FormLabel>
              <FormControl>
                <Input {...field} />
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
              <FormLabel>기사 연락처</FormLabel>
              <FormControl>
                <Input {...field} type="tel" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="carrier_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>소속 운수사</FormLabel>
              <FormControl>
                <Input {...field} />
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
              <FormLabel>차종/톤수</FormLabel>
              <FormControl>
                <Input {...field} />
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
            disabled={isPending}
          >
            {isPending ? "저장 중..." : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  )
}
