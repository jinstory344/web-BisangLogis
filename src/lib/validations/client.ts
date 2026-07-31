import { z } from "zod"

import { bizNoSchema } from "@/lib/biz-no"

export const clientFormSchema = z.object({
  name: z.string().trim().min(1, "사업자명을 입력하세요"),
  biz_no: bizNoSchema,
  ceo_name: z.string().trim(),
  address: z.string().trim(),
  biz_type: z.string().trim(),
  biz_item: z.string().trim(),
  contact_name: z.string().trim(),
  contact_phone: z.string().trim(),
  contact_email: z.union([z.literal(""), z.string().trim().email("이메일 형식이 올바르지 않습니다")]),
  memo: z.string().trim(),
})

export type ClientFormValues = z.infer<typeof clientFormSchema>

export const clientFormDefaults: ClientFormValues = {
  name: "",
  biz_no: "",
  ceo_name: "",
  address: "",
  biz_type: "",
  biz_item: "",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  memo: "",
}
