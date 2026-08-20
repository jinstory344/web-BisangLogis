/** 매출 등록 폼 "출처"(고객 유입 경로) 대분류. */
export const SOURCE_MAJOR_OPTIONS = [
  "거래처",
  "지인",
  "해피",
  "에이스",
  "스마일",
  "카카오톡",
  "밴드",
  "24시콜화물",
  "기타",
] as const

export type SourceMajor = (typeof SOURCE_MAJOR_OPTIONS)[number]

/** 대분류 "거래처" 선택 시 소분류 드롭다운 옵션. */
export const SOURCE_CLIENT_MINOR_OPTIONS = [
  "우영로지스",
  "조은물류",
  "조은푸드",
  "아토무역",
  "아르켓",
  "빌리어네어즈스토어",
  "무빙에프앤비",
  "CSP",
] as const
