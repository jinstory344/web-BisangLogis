"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useActionState } from "react"
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
import { clientFormSchema, type ClientFormValues } from "@/lib/validations/client"

import type { ClientActionState } from "./actions"

interface ClientFormProps {
  action: (
    prevState: ClientActionState,
    formData: FormData
  ) => Promise<ClientActionState>
  defaultValues: ClientFormValues
  submitLabel: string
}

export function ClientForm({
  action,
  defaultValues,
  submitLabel,
}: ClientFormProps) {
  const [state, formAction, isPending] = useActionState(action, {
    error: null,
  })
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues,
  })

  function onSubmit(values: ClientFormValues) {
    const fd = new FormData()
    Object.entries(values).forEach(([key, value]) => fd.set(key, value))
    formAction(fd)
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4 pb-24 md:pb-0"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>사업자명 *</FormLabel>
              <FormControl>
                <Input {...field} autoFocus />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="biz_no"
          render={({ field }) => (
            <FormItem>
              <FormLabel>사업자등록번호</FormLabel>
              <FormControl>
                <Input {...field} placeholder="10자리 (하이픈 없이 입력 가능)" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ceo_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>대표자명</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>주소</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="biz_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>업태</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="biz_item"
            render={({ field }) => (
              <FormItem>
                <FormLabel>종목</FormLabel>
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
          name="contact_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>담당자명</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contact_phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>담당자 연락처</FormLabel>
              <FormControl>
                <Input {...field} type="tel" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contact_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>세금계산서 수신 이메일</FormLabel>
              <FormControl>
                <Input {...field} type="email" />
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
