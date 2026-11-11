/** 매출 등록 폼 "출처"(고객 유입 경로) 대분류. */
export const SOURCE_MAJOR_OPTIONS = [
  "거래처",
  "지인",
  "카카오톡",
  "밴드",
  "24시콜화물",
  "기타",
] as const

export type SourceMajor = (typeof SOURCE_MAJOR_OPTIONS)[number]

/**
 * 대분류 "거래처": 소분류를 거래처 명단(clients)에서 고르고, 그 거래처와 연결된다(sales.client_id).
 * 그 외 대분류는 소분류를 이름·업체명으로 직접 입력하며 거래처 연결이 없다.
 * (예전에는 소분류 거래처 이름 8개가 코드에 고정돼 있었지만, 이제는 거래처 페이지의 명단을 쓴다.)
 */
export const SOURCE_MAJOR_CLIENT: SourceMajor = "거래처"
