"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react"
import {
  startTransition,
  useActionState,
  useId,
  useState,
  type ComponentProps,
} from "react"
import { useFieldArray, useForm } from "react-hook-form"

import { FormSubmitBar, touchFormProps } from "@/components/form/form-submit-bar"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatBizNo } from "@/lib/biz-no"
import { type ClientDuplicate } from "@/lib/client-duplicates"
import { cn } from "@/lib/utils"
import { clientFormSchema, type ClientFormValues } from "@/lib/validations/client"

import { findDuplicateClientsAction, type ClientActionState } from "./actions"

interface ClientFormProps {
  action: (
    prevState: ClientActionState,
    formData: FormData
  ) => Promise<ClientActionState>
  defaultValues: ClientFormValues
  submitLabel: string
  /** 수정 화면에서만 넘긴다 — 중복 확인에서 자기 자신을 뺀다. */
  clientId?: string
}

/** 세금계산서 정보 칸 중 하나라도 값이 있는지 — 있으면 모바일에서도 펼친 채로 연다. */
function hasTaxSectionValues(values: ClientFormValues): boolean {
  return [
    values.biz_no,
    values.ceo_name,
    values.address,
    values.biz_type,
    values.biz_item,
    values.contact_email,
  ].some((value) => value.trim() !== "")
}

/** 세금계산서 정보 칸에서 검증 오류가 날 수 있는 필드 — 접힌 채로 오류가 숨지 않게 펼치는 기준 */
const TAX_SECTION_ERROR_FIELDS = ["biz_no", "contact_email"] as const

function TextField({
  form,
  name,
  label,
  inputProps,
}: {
  form: ReturnType<typeof useForm<ClientFormValues>>
  name: Exclude<keyof ClientFormValues, "category" | "memo" | "contacts">
  label: string
  inputProps?: ComponentProps<typeof Input>
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} {...inputProps} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

/**
 * 거래처 등록/수정 폼.
 * - 거래처명·담당자·연락처: 배차에는 이것만 있으면 된다. (구분 내/타 거래처는 화면에서 뺐다 — 저장 값은 그대로 둔다)
 * - 사업자 정보(사업자번호·대표자·주소·업태·종목·이메일): 접어 두는 선택 입력.
 *   매출은 이 정보 없이도 저장되고, 계산서를 발행할 때 채워도 된다. 모바일은 접고 데스크톱은 항상 펼친다.
 */
export function ClientForm({
  action,
  defaultValues,
  submitLabel,
  clientId,
}: ClientFormProps) {
  const [state, formAction, isPending] = useActionState(action, {
    error: null,
  })
  const taxSectionId = useId()
  const [isTaxOpen, setIsTaxOpen] = useState(() =>
    hasTaxSectionValues(defaultValues)
  )
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState<{
    formData: FormData
    duplicates: ClientDuplicate[]
  } | null>(null)

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues,
  })
  const contactFields = useFieldArray({ control: form.control, name: "contacts" })

  async function onSubmit(values: ClientFormValues) {
    const fd = new FormData()
    Object.entries(values).forEach(([key, value]) =>
      fd.set(key, typeof value === "string" ? value : JSON.stringify(value))
    )

    // 같은 이름·사업자번호의 거래처가 이미 있으면 한 번 확인받는다. 확인 자체가 실패해도
    // 저장을 막지는 않는다 (안내용 장치라서).
    setIsCheckingDuplicate(true)
    let duplicates: ClientDuplicate[] = []
    try {
      duplicates = await findDuplicateClientsAction({
        name: values.name,
        bizNo: values.biz_no,
        excludeId: clientId,
      })
    } catch {
      duplicates = []
    } finally {
      setIsCheckingDuplicate(false)
    }

    if (duplicates.length > 0) {
      setPendingSubmit({ formData: fd, duplicates })
      return
    }

    // useActionState의 formAction을 수동 호출할 때는 반드시 transition으로 감싼다.
    startTransition(() => {
      formAction(fd)
    })
  }

  function onInvalid(errors: typeof form.formState.errors) {
    // 접힌 세금계산서 정보 칸에서 난 오류는 보이지 않으므로 펼쳐서 보여 준다.
    if (TAX_SECTION_ERROR_FIELDS.some((field) => errors[field])) {
      setIsTaxOpen(true)
    }
  }

  function handleConfirmDuplicate() {
    if (pendingSubmit) {
      const { formData } = pendingSubmit
      startTransition(() => {
        formAction(formData)
      })
    }
    setPendingSubmit(null)
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        {...touchFormProps}
      >
        <TextField form={form} name="name" label="거래처명 *" />

        {/* 담당자 여러 명: 한 줄에 한 명(이름 · 전화), + 담당자 추가 / ✕ 지우기 */}
        <div className="flex flex-col">
          <p className="pt-3 pb-1 text-sm text-muted-foreground">담당자 <span className="text-xs">(맨 위가 대표 담당자)</span></p>
          {contactFields.fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1.4fr)_2.5rem] items-center gap-2 border-b">
              {/* 순서 바꾸기: 위·아래 화살표 (첫 담당자가 대표 담당자로 거래처 목록에 보인다) */}
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={`담당자 ${index + 1} 위로`}
                  disabled={index === 0}
                  onClick={() => contactFields.move(index, index - 1)}
                  className="flex h-5 items-center justify-center text-muted-foreground disabled:opacity-25"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`담당자 ${index + 1} 아래로`}
                  disabled={index === contactFields.fields.length - 1}
                  onClick={() => contactFields.move(index, index + 1)}
                  className="flex h-5 items-center justify-center text-muted-foreground disabled:opacity-25"
                >
                  <ChevronDown className="size-4" />
                </button>
              </div>
              <Input
                {...form.register(`contacts.${index}.name`)}
                placeholder="이름"
                aria-label={`담당자 ${index + 1} 이름`}
                className="h-11 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
              <Input
                {...form.register(`contacts.${index}.phone`)}
                type="tel"
                inputMode="tel"
                placeholder="010-0000-0000"
                aria-label={`담당자 ${index + 1} 전화`}
                className="h-11 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
              <button
                type="button"
                aria-label={`담당자 ${index + 1} 지우기`}
                onClick={() =>
                  contactFields.fields.length > 1
                    ? contactFields.remove(index)
                    : form.setValue(`contacts.${index}`, { name: "", phone: "" })
                }
                className="flex size-10 items-center justify-center text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => contactFields.append({ name: "", phone: "" })}
            className="mt-3 flex h-10 items-center justify-center gap-1 rounded-lg border border-dashed text-sm text-foreground/80"
          >
            <Plus className="size-4" />
            담당자 추가
          </button>
        </div>

        {/* 세금계산서 정보: 모바일은 접고, 데스크톱은 항상 펼친 제목으로 보여 준다. */}
        <button
          type="button"
          aria-expanded={isTaxOpen}
          aria-controls={taxSectionId}
          onClick={() => setIsTaxOpen((open) => !open)}
          className="mt-1 flex min-h-11 items-center gap-1.5 text-left text-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
        >
          <span>사업자 정보 (선택)</span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              isTaxOpen && "rotate-180"
            )}
          />
        </button>
        <div className="mt-2 hidden items-center gap-2 md:flex">
          <h2 className="text-sm font-semibold text-muted-foreground">
            사업자 정보 (선택)
          </h2>
        </div>

        <div
          id={taxSectionId}
          className={cn("flex-col md:flex md:gap-4", isTaxOpen ? "flex" : "hidden")}
        >
          <TextField
            form={form}
            name="biz_no"
            label="사업자번호"
            inputProps={{
              inputMode: "numeric",
              placeholder: "10자리 (하이픈 없이 입력 가능)",
            }}
          />
          <TextField form={form} name="ceo_name" label="대표자명" />
          <TextField form={form} name="address" label="주소" />
          <div className="grid md:grid-cols-2 md:gap-4">
            <TextField form={form} name="biz_type" label="업태" />
            <TextField form={form} name="biz_item" label="종목" />
          </div>
          <TextField
            form={form}
            name="contact_email"
            label="이메일"
            inputProps={{ type: "email" }}
          />
        </div>

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

        <FormSubmitBar disabled={isPending || isCheckingDuplicate}>
          {isPending
            ? "저장 중..."
            : isCheckingDuplicate
              ? "중복 확인 중..."
              : submitLabel}
        </FormSubmitBar>
      </form>

      <AlertDialog
        open={pendingSubmit !== null}
        onOpenChange={(open) => !open && setPendingSubmit(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              같은 거래처가 이미 있는 것 같아요
            </AlertDialogTitle>
            <AlertDialogDescription>
              아래 거래처와 이름이나 사업자번호가 같아요. 같은 업체라면 새로
              만들지 말고 그 거래처를 수정해 주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="flex flex-col gap-1.5 text-sm">
            {pendingSubmit?.duplicates.map((duplicate) => (
              <li key={duplicate.id} className="rounded-md border px-3 py-2">
                <span className="font-medium">{duplicate.name}</span>
                <span className="ml-2 text-muted-foreground">
                  {[
                    duplicate.sameName ? "이름이 같아요" : null,
                    duplicate.sameBizNo ? "사업자번호가 같아요" : null,
                    duplicate.biz_no
                      ? formatBizNo(duplicate.biz_no)
                      : "사업자번호 없음",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
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
