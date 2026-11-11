"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown } from "lucide-react"
import {
  startTransition,
  useActionState,
  useId,
  useState,
  type ComponentProps,
} from "react"
import { useForm } from "react-hook-form"

import { TaxInfoBadge } from "@/components/clients/tax-info-badge"
import { ChoiceChips } from "@/components/form/choice-chips"
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
import { getTaxInfoStatus } from "@/lib/client-tax-info"
import { CLIENT_CATEGORY_OPTIONS } from "@/lib/constants/client"
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
  name: Exclude<keyof ClientFormValues, "category" | "memo">
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
 * - 기본 정보(거래처명·구분·담당자·연락처): 배차에는 이것만 있으면 된다.
 * - 세금계산서 정보(사업자번호·대표자·주소·업태·종목·이메일): 접어 두는 선택 입력.
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

  const taxStatus = getTaxInfoStatus(form.watch())

  async function onSubmit(values: ClientFormValues) {
    const fd = new FormData()
    Object.entries(values).forEach(([key, value]) => fd.set(key, value))

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
        <h2 className="text-sm font-semibold text-muted-foreground">
          기본 정보
        </h2>

        <TextField form={form} name="name" label="거래처명 *" />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>구분</FormLabel>
              <FormControl>
                <ChoiceChips
                  aria-label="거래처 구분"
                  options={CLIENT_CATEGORY_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <TextField form={form} name="contact_name" label="담당자" />
          <TextField
            form={form}
            name="contact_phone"
            label="연락처"
            inputProps={{ type: "tel", placeholder: "010-0000-0000" }}
          />
        </div>

        {/* 세금계산서 정보: 모바일은 접고, 데스크톱은 항상 펼친 제목으로 보여 준다. */}
        <button
          type="button"
          aria-expanded={isTaxOpen}
          aria-controls={taxSectionId}
          onClick={() => setIsTaxOpen((open) => !open)}
          className="mt-2 flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
        >
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="shrink-0">세금계산서 정보</span>
            <TaxInfoBadge status={taxStatus} />
          </span>
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
            세금계산서 정보
          </h2>
          <TaxInfoBadge status={taxStatus} />
        </div>

        <div
          id={taxSectionId}
          className={cn("flex-col gap-4 md:flex", isTaxOpen ? "flex" : "hidden")}
        >
          <p className="text-xs text-muted-foreground">
            계산서를 발행할 때 필요한 정보예요. 지금 몰라도 괜찮고, 나중에
            채워도 돼요.
          </p>
          <TextField
            form={form}
            name="biz_no"
            label="사업자등록번호"
            inputProps={{
              inputMode: "numeric",
              placeholder: "10자리 (하이픈 없이 입력 가능)",
            }}
          />
          <TextField form={form} name="ceo_name" label="대표자명" />
          <TextField form={form} name="address" label="주소" />
          <div className="grid gap-4 md:grid-cols-2">
            <TextField form={form} name="biz_type" label="업태" />
            <TextField form={form} name="biz_item" label="종목" />
          </div>
          <TextField
            form={form}
            name="contact_email"
            label="세금계산서 수신 이메일"
            inputProps={{ type: "email" }}
          />
        </div>

        <FormField
          control={form.control}
          name="memo"
          render={({ field }) => (
            <FormItem className="mt-2">
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
