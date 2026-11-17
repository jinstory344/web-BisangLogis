/**
 * 거래처의 "세금계산서 정보" 입력 상태.
 *
 * 계산서를 발행할 때 꼭 필요한 5개 항목(사업자번호·대표자·주소·업태·종목)이 모두 있으면 완비다.
 * 수신 이메일은 전자 발행 때 권장되지만 필수는 아니라서 완비 여부에는 넣지 않는다.
 * 매출은 이 정보 없이도 저장할 수 있으므로, 이 상태는 "나중에 채우면 되는 곳"을 알려 주는 표시용이다.
 */
export const TAX_INFO_REQUIRED_FIELDS = [
  "biz_no",
  "ceo_name",
  "address",
  "biz_type",
  "biz_item",
] as const

export type TaxInfoField = (typeof TAX_INFO_REQUIRED_FIELDS)[number]

export type TaxInfoLevel = "empty" | "partial" | "complete"

export interface TaxInfoStatus {
  /** 채워진 필수 항목 수 */
  filled: number
  total: number
  level: TaxInfoLevel
}

export function getTaxInfoStatus(
  values: Partial<Record<TaxInfoField, string | null | undefined>>
): TaxInfoStatus {
  const total = TAX_INFO_REQUIRED_FIELDS.length
  const filled = TAX_INFO_REQUIRED_FIELDS.filter(
    (field) => (values[field]?.trim() ?? "") !== ""
  ).length

  return {
    filled,
    total,
    level: filled === 0 ? "empty" : filled === total ? "complete" : "partial",
  }
}

/** 화면에 보여 주는 짧은 문구: "계산서 정보 완비" / "계산서 정보 3/5" / "계산서 정보 없음" */
export function formatTaxInfoStatus(status: TaxInfoStatus): string {
  if (status.level === "complete") return "계산서 정보 완비"
  if (status.level === "empty") return "계산서 정보 없음"
  return `계산서 정보 ${status.filled}/${status.total}`
}

/**
 * 거래처 목록 [복사] — 계산서용 사업자 정보를 문자로 보내기 좋은 모양으로.
 * < 조은물류 사업자정보 > / (빈 줄) / 사업자번호 / 상호 / 대표 / 주소 / 업태, 종목 / 이메일 / 비고(전화·팩스·안내 문구).
 * 빈 칸은 줄째로 뺀다. 비고의 줄바꿈(\r\n)은 그대로 살린다.
 */
export function clientBizInfoText(c: {
  name: string
  biz_no: string | null
  ceo_name: string | null
  address: string | null
  biz_type: string | null
  biz_item: string | null
  contact_email: string | null
  memo: string | null
}): string {
  const bizNo = (c.biz_no ?? "").replace(/\D/g, "")
  const lines = [
    bizNo.length === 10 ? `${bizNo.slice(0, 3)}-${bizNo.slice(3, 5)}-${bizNo.slice(5)}` : c.biz_no?.trim(),
    c.name.trim(),
    c.ceo_name?.trim(),
    c.address?.trim(),
    [c.biz_type?.trim(), c.biz_item?.trim()].filter(Boolean).join(", "),
    c.contact_email?.trim(),
  ].filter(Boolean)
  const memo = (c.memo ?? "").replace(/\r\n?/g, "\n").trim()
  return [`< ${c.name.trim()} 사업자정보 >`, "", ...lines, ...(memo ? [memo] : [])].join("\n")
}
