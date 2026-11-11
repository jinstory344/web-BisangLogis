import { z } from "zod"

import { bizNoSchema } from "@/lib/biz-no"
import { DEFAULT_CLIENT_CATEGORY } from "@/lib/constants/client"

export const clientFormSchema = z.object({
  name: z.string().trim().min(1, "거래처명을 입력하세요"),
  /** 내 거래처 / 타 거래처 — 보기 편하게 걸러 주는 표시 */
  category: z.enum(["MINE", "OTHER"]),
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
  category: DEFAULT_CLIENT_CATEGORY,
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
