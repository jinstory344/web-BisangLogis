/** 중복 확인에 쓰는 거래처 최소 정보 */
export interface ClientMatch {
  id: string
  name: string
  biz_no: string | null
}

/** 거래처 등록·수정 전 중복 확인 결과 한 건: 어떤 점이 같은지 함께 알려 준다. */
export interface ClientDuplicate extends ClientMatch {
  sameName: boolean
  sameBizNo: boolean
}

/**
 * "이름이 같은 거래처"와 "사업자번호가 같은 거래처" 두 조회 결과를 한 목록으로 합친다.
 * 이름과 사업자번호가 모두 같은 거래처는 한 줄로 합쳐 두 이유를 함께 표시하고,
 * 이름이 같은 것이 먼저, 그다음 사업자번호만 같은 것이 온다.
 */
export function mergeClientDuplicates(
  sameName: readonly ClientMatch[],
  sameBizNo: readonly ClientMatch[]
): ClientDuplicate[] {
  const byId = new Map<string, ClientDuplicate>()

  for (const row of sameName) {
    byId.set(row.id, { ...row, sameName: true, sameBizNo: false })
  }
  for (const row of sameBizNo) {
    const known = byId.get(row.id)
    byId.set(row.id, {
      ...row,
      sameName: known?.sameName ?? false,
      sameBizNo: true,
    })
  }

  return [...byId.values()]
}
